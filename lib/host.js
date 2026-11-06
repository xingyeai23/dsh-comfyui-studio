/**
 * dsh-comfyui-studio — Host half.
 *
 * One same-origin HTTP prefix (`/comfyui-panel/*`) for the studio panel:
 * ComfyUI facts and live hardware metrics, the user's saved workflows converted
 * from frontend graphs into API prompts, AI prompt rewriting through this
 * Harness profile's `llm` service, and image proxying.
 *
 * Every route answers same-origin callers only. ComfyUI access always appends
 * fixed paths to a validated `base` origin; workflow names and image
 * coordinates are validated before they reach the upstream.
 */
import {
  buildTxt2ImgGraph,
  clearQueue,
  discover,
  fetchModels,
  fetchQueue,
  interrupt,
  jobStatus,
  normalizeBaseUrl,
  normalizeParams,
  probeSystem,
  recentOutputs,
  viewImage,
  PLUGIN_VERSION,
  ComfyUpstreamError,
} from './comfy.js';
import {
  deleteUserWorkflow,
  fetchNodeCatalog,
  fetchObjectInfo,
  fetchUserWorkflow,
  listUserWorkflows,
  normalizeWorkflowFileName,
  saveUserWorkflow,
  submitGraph,
} from './studio-upstream.js';
import { createProgressTracker } from './progress.js';
import { applyOverrides, classifyModel, collectNodeTypes, convertWorkflow, summarizeWorkflow } from './workflow.js';

/** Route prefix owned by this plugin. */
const ROUTE_PREFIX = '/comfyui-panel';
/** Default upstream used when the row's config has no usable `baseUrl`. */
const DEFAULT_BASE_URL = 'http://127.0.0.1:8188';
/** Request body cap. */
const MAX_BODY_BYTES = 512 * 1024;
/** Largest workflow graph accepted by the save route. */
const MAX_SAVED_GRAPH_BYTES = 8 * 1024 * 1024;
/** Save-route body cap: the graph plus its JSON envelope. */
const MAX_SAVE_BODY_BYTES = MAX_SAVED_GRAPH_BYTES + 64 * 1024;
/** Discovery result reuse. */
const DISCOVERY_CACHE_MS = 30000;
/** Workflow list reuse. */
const WORKFLOW_LIST_TTL_MS = 30000;
/** Converted workflow reuse. */
const WORKFLOW_TTL_MS = 5 * 60 * 1000;
const MAX_WORKFLOW_CACHE_ENTRIES = 32;

/** System prompts for the two rewrite modes. */
const REWRITE_SYSTEM_TAGS = [
  'You are a prompt engineer for Stable Diffusion anime models (Illustrious / NoobAI / SDXL).',
  'Convert any Chinese (or mixed) user text into English danbooru-style prompt tags.',
  'Rules: keep existing English tags, weights like (tag:1.2), and <lora:...> tokens unchanged;',
  'put quality tags first: masterpiece, best quality, absurdres (unless they already exist);',
  'use lowercase comma-separated tags; keep the user intent and add only details clearly implied;',
  'output ONLY the tags, no quotes, no explanation, no markdown.',
].join(' ');

const REWRITE_SYSTEM_NATURAL = [
  'You rewrite image-generation ideas into English prompts for modern text-to-image models.',
  'Convert any Chinese (or mixed) user text into ONE polished natural-language English paragraph.',
  'Keep existing English phrases, weights and <lora:...> tokens unchanged; do not add new characters or unrelated details;',
  'output ONLY the paragraph, no quotes, no explanation, no markdown.',
].join(' ');

const REWRITE_SYSTEM_BOTH = [
  'You prepare image-generation prompts for models that accept both danbooru tags and natural language.',
  'Convert any Chinese (or mixed) user text into TWO parts:',
  'line 1: English danbooru-style comma-separated tags (quality tags first: masterpiece, best quality, absurdres);',
  'line 2: one polished natural-language English sentence describing the same image.',
  'Keep existing English tags, weights and <lora:...> tokens unchanged; output ONLY those two lines, no labels, no quotes, no markdown.',
].join(' ');

const REWRITE_SYSTEM_ZH = 'Translate the English image-generation prompt into natural, readable Chinese for the user to review. Preserve tag meanings, weights and <lora:...> tokens; output only the Chinese translation, no explanation, no markdown.';

/**
 * Model-specific parameter guidance shown under the panel's controls.
 * Anima values come from https://civitai.com/models/2458426/anima .
 * @param {unknown} checkpoint checkpoint or unet name.
 * @returns {Record<string, string> | null} hints by field, or null for generic copy.
 */
function modelParamHints(checkpoint) {
  const name = String(checkpoint ?? '').toLowerCase();
  if (name.includes('anima')) {
    return {
      steps: '官方 30–50',
      cfg: '官方 4–6',
      sampler: '官方 er_sde / euler_a / dpmpp_2m_sde_gpu',
      scheduler: '官方未限定 · 工作流 simple',
      width: '官方 512–1536',
      height: '官方 512–1536',
      seed: '0 – 4294967295 · 可随机',
      batch: '1–4',
    };
  }
  if (name.includes('noob') || name.includes('illustrious')) {
    return {
      steps: '常用 20–30',
      cfg: '常用 5–7',
      sampler: '常用 euler / euler_ancestral',
      scheduler: '常用 normal / karras',
      width: '常用 832×1216 / 1024×1024 · 8 的倍数',
      height: '常用 832×1216 / 1024×1024 · 8 的倍数',
      seed: '0 – 4294967295 · 可随机',
      batch: '1–4',
    };
  }
  return null;
}

/** Workflows whose prompts follow the model author's official documentation. */
const WORKFLOW_PRESETS = Object.freeze({
  'anima.json': Object.freeze({
    // https://civitai.com/models/2458426/anima · https://huggingface.co/LyliaEngine/anima_baseV10
    negative: 'worst quality, low quality, score_1, score_2, score_3, artist name',
    positivePrefix: 'masterpiece, best quality, score_7, safe, ',
  }),
});

/** @type {Map<number, { at: number, result: unknown }>} */
const discoveryCache = new Map();
/** @type {Map<string, { at: number, workflows: any[] }>} */
const workflowListCache = new Map();
/** @type {Map<string, { at: number, revision: number, result: any }>} */
const workflowCache = new Map();

/**
 * Resolve the row config into validated runtime options.
 * @param {Record<string, unknown> | undefined} config patch row config.
 * @returns {{ defaultBaseUrl: string, discoveryPort: number, requestTimeoutMs: number, discoverTimeoutMs: number, llmProvider: string, llmModel: string, rewriteMaxTokens: number, rewriteReasoningEffort: string }}
 */
export function resolveConfig(config) {
  const rawBase = typeof config?.baseUrl === 'string' ? config.baseUrl : '';
  let defaultBaseUrl = DEFAULT_BASE_URL;
  try {
    defaultBaseUrl = normalizeBaseUrl(rawBase === '' ? DEFAULT_BASE_URL : rawBase);
  } catch {
    defaultBaseUrl = DEFAULT_BASE_URL;
  }
  return {
    defaultBaseUrl,
    discoveryPort: clampInteger(config?.discoveryPort, 1, 65535, 8188),
    requestTimeoutMs: clampInteger(config?.requestTimeoutMs, 500, 120000, 8000),
    discoverTimeoutMs: clampInteger(config?.discoverTimeoutMs, 100, 20000, 1200),
    llmProvider: typeof config?.llmProvider === 'string' ? config.llmProvider.trim() : '',
    llmModel: typeof config?.llmModel === 'string' ? config.llmModel.trim() : '',
    rewriteMaxTokens: clampInteger(config?.rewriteMaxTokens, 100, 4000, 800),
    rewriteReasoningEffort: config?.rewriteReasoningEffort === 'low' || config?.rewriteReasoningEffort === 'high'
      ? config.rewriteReasoningEffort
      : 'off',
  };
}

/**
 * @param {unknown} value raw value.
 * @param {number} min lowest accepted value.
 * @param {number} max highest accepted value.
 * @param {number} fallback value used when the input is not an integer in range.
 * @returns {number} validated integer.
 */
function clampInteger(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) return fallback;
  return number;
}

/**
 * Same-origin check: same-origin browser fetches carry an Origin equal to Host;
 * the Desktop shell's bridge strips Origin. Cross-site requests are refused.
 * @param {import('node:http').IncomingMessage} req request.
 * @returns {boolean} whether the request may run.
 */
export function isTrusted(req) {
  const origin = req.headers.origin;
  if (origin === undefined || origin === '') return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/**
 * @param {import('node:http').ServerResponse} res response.
 * @param {number} status HTTP status.
 * @param {unknown} body JSON value.
 * @returns {void}
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(payload)),
  });
  res.end(payload);
}

/**
 * @param {import('node:http').ServerResponse} res response.
 * @param {number} status HTTP status.
 * @param {Buffer} buffer response body.
 * @param {string} contentType response content type.
 * @param {Record<string, string>} [headers] extra headers.
 * @returns {void}
 */
function sendBytes(res, status, buffer, contentType, headers = {}) {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-length': String(buffer.length),
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(buffer);
}

/**
 * @param {unknown} error thrown value.
 * @returns {string} message.
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read a JSON request body with a hard byte cap.
 * @param {import('node:http').IncomingMessage} req request.
 * @param {number} [maxBytes] accepted body size (defaults to {@link MAX_BODY_BYTES}).
 * @returns {Promise<any>} parsed body (`{}` when empty).
 */
function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBytes) {
        failed = true;
        reject(Object.assign(new Error('request body is too large'), { status: 413 }));
        // Drain the remaining bytes so the 413 answer can reach the client.
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (text === '') {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('request body must be a JSON object'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error('request body is not valid JSON'));
      }
    });
    req.on('error', (error) => reject(error));
  });
}

/**
 * Read a JSON body, answering 400 when it is unusable.
 * @param {import('node:http').IncomingMessage} req request.
 * @param {import('node:http').ServerResponse} res response.
 * @param {number} [maxBytes] accepted body size.
 * @returns {Promise<any | null>} parsed body, or null after a 400 was sent.
 */
async function readBody(req, res, maxBytes) {
  try {
    return await readJsonBody(req, maxBytes);
  } catch (error) {
    const status = Number(error?.status) === 413 ? 413 : 400;
    sendJson(res, status, { ok: false, error: messageOf(error) });
    return null;
  }
}

/**
 * @param {unknown} raw base from a query string or JSON body.
 * @param {string} fallback configured default.
 * @returns {string} normalised base URL.
 */
function resolveBase(raw, fallback) {
  const candidate = typeof raw === 'string' && raw.trim() !== '' ? raw : fallback;
  return normalizeBaseUrl(candidate);
}

/**
 * Parse the comma-separated node types of the object-info route.
 * @param {string | null} raw `types` query value.
 * @returns {string[] | null} unique usable types, or null when the parameter is invalid.
 */
function parseObjectInfoTypes(raw) {
  if (typeof raw !== 'string') return null;
  const types = [];
  for (const part of raw.split(',')) {
    const type = part.trim();
    if (type === '') continue;
    if (type.length > 200) return null;
    types.push(type);
  }
  if (types.length === 0 || types.length > 64) return null;
  return [...new Set(types)];
}

/**
 * @param {unknown} graph request `graph` value.
 * @returns {graph is { nodes: any[], links: any[] }} whether it is a frontend workflow.
 */
function isWorkflowGraph(graph) {
  return graph !== null
    && typeof graph === 'object'
    && !Array.isArray(graph)
    && Array.isArray(/** @type {any} */ (graph).nodes)
    && Array.isArray(/** @type {any} */ (graph).links);
}

/**
 * @param {import('node:http').ServerResponse} res response.
 * @returns {void}
 */
function methodNotAllowed(res) {
  sendJson(res, 405, { ok: false, error: 'method not allowed' });
}

/**
 * Clean up a model response into a usable prompt.
 * @param {string} text raw model text.
 * @param {'tags' | 'natural'} mode rewrite mode.
 * @returns {string} sanitized text.
 */
export function sanitizeRewrite(text, mode) {
  let out = String(text ?? '').trim();
  out = out.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  out = out.replace(/^(prompt|提示词|tags|输出)\s*[:：]\s*/i, '').trim();
  out = out.replace(/^["'“”「」]+|["'“”「」]+$/g, '').trim();
  if (mode === 'tags') {
    out = out.replace(/\s*\n+\s*/g, ', ');
    out = out.replace(/\s*,\s*/g, ', ');
    out = out.replace(/(?:,\s*){2,}/g, ', ').replace(/^,\s*/, '').replace(/,\s*$/, '');
    out = out.replace(/\s{2,}/g, ' ');
  } else {
    out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }
  return out;
}

/**
 * Rewrite a prompt with the profile's default model.
 * @param {any} ctx Host plugin context.
 * @param {ReturnType<typeof resolveConfig>} options runtime options.
 * @param {unknown} input request body.
 * @returns {Promise<{ text: string, provider: string, model: string, mode: 'tags' | 'natural' }>}
 */
export async function rewritePrompt(ctx, options, input) {
  const body = input !== null && typeof input === 'object' ? /** @type {any} */ (input) : {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text === '') throw new Error('提示词不能为空');
  if (text.length > 6000) throw new Error('提示词过长（上限 6000 字符）');
  const mode = body.kind === 'natural' || body.kind === 'both' || body.kind === 'zh'
    ? body.kind
    : body.mode === 'natural' ? 'natural' : 'tags';
  const llm = typeof ctx.get === 'function' ? ctx.get('llm') : undefined;
  if (llm === undefined || llm === null || typeof llm.stream !== 'function') {
    throw new Error('当前 profile 没有可用的 LLM 服务，无法做提示词转写');
  }
  let selection = null;
  try {
    selection = ctx.get('agentDefaultModel')?.currentSelection?.() ?? null;
  } catch {
    selection = null;
  }
  const provider = options.llmProvider !== '' ? options.llmProvider : selection !== null && typeof selection.provider === 'string' ? selection.provider : '';
  const model = options.llmModel !== '' ? options.llmModel : selection !== null && typeof selection.model === 'string' ? selection.model : '';
  if (provider === '' || model === '') throw new Error('没有可用的默认模型，请在插件配置里指定 llmProvider / llmModel');

  // Long prompts and Chinese translations need more than the tags budget; the
  // reasoning tokens are part of this cap, so size it from the input length.
  const tokenBudget = Math.max(options.rewriteMaxTokens, Math.min(4000, Math.ceil(text.length * 2) + 600));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const request = {
        provider,
        model,
        system: mode === 'tags' ? REWRITE_SYSTEM_TAGS : mode === 'both' ? REWRITE_SYSTEM_BOTH : mode === 'zh' ? REWRITE_SYSTEM_ZH : REWRITE_SYSTEM_NATURAL,
        messages: [{ role: 'user', content: [{ type: 'text', text }] }],
        maxTokens: tokenBudget,
        temperature: 0.3,
        signal: controller.signal,
      };
      if (attempt === 0) request.reasoningEffort = options.rewriteReasoningEffort;
      let out = '';
      let failure = null;
      for await (const chunk of llm.stream(request)) {
        if (chunk.type === 'text-delta') out += chunk.text;
        else if (chunk.type === 'finish' && chunk.reason !== null && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
          failure = chunk.reason.failure ?? null;
        }
      }
      if (failure !== null && failure.code === 'UNSUPPORTED_REASONING_EFFORT' && attempt === 0) continue;
      if (failure !== null) throw new Error(failure.message || '模型调用失败');
      const cleaned = sanitizeRewrite(out, mode);
      if (cleaned === '') throw new Error('模型没有返回提示词');
      return { text: cleaned, provider, model, kind: mode };
    }
    throw new Error('模型调用失败');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a discovery scan behind a short cache.
 * @param {number} port scan port.
 * @param {ReturnType<typeof resolveConfig>} options runtime options.
 * @param {typeof discover} discoverFn scan implementation.
 * @returns {Promise<any>} scan result.
 */
async function cachedDiscovery(port, options, discoverFn) {
  const cached = discoveryCache.get(port);
  if (cached !== undefined && Date.now() - cached.at < DISCOVERY_CACHE_MS) return cached.result;
  const result = await discoverFn({
    port,
    timeoutMs: options.discoverTimeoutMs,
    include: [options.defaultBaseUrl],
  });
  discoveryCache.set(port, { at: Date.now(), result });
  return result;
}

/**
 * List the saved workflows with a cheap summary.
 * @param {string} base normalised base URL.
 * @param {number} timeoutMs request timeout.
 * @returns {Promise<any[]>} workflow summaries.
 */
async function cachedWorkflowList(base, timeoutMs) {
  const cached = workflowListCache.get(base);
  if (cached !== undefined && Date.now() - cached.at < WORKFLOW_LIST_TTL_MS) return cached.workflows;
  const names = await listUserWorkflows(base, { timeoutMs });
  const workflows = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < names.length) {
      const name = names[cursor];
      cursor += 1;
      try {
        const raw = await fetchUserWorkflow(base, name, { timeoutMs });
        const summary = summarizeWorkflow(raw);
        let supported = false;
        let reasons = [...summary.reasons];
        let missingAssets = [];
        let cleanupApplied = false;
        if (summary.runnable) {
          try {
            const loaded = await loadWorkflow(base, name, timeoutMs);
            supported = loaded.converted.supported;
            reasons = loaded.converted.reasons;
            missingAssets = loaded.converted.missingAssets;
            cleanupApplied = loaded.converted.cleanup !== null && loaded.converted.cleanup !== undefined;
          } catch (error) {
            reasons = [messageOf(error)];
          }
        }
        workflows.push({ name, ...summary, supported, reasons, missingAssets, cleanupApplied });
      } catch (error) {
        workflows.push({ name, nodeCount: 0, hasSubgraph: true, outputKind: 'unknown', runnable: false, supported: false, reasons: [messageOf(error)], missingAssets: [], cleanupApplied: false });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, names.length) }, worker));
  workflows.sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }));
  workflowListCache.set(base, { at: Date.now(), workflows });
  return workflows;
}

/**
 * Convert one saved workflow, reusing the previous conversion while its
 * frontend revision is unchanged.
 * @param {string} base normalised base URL.
 * @param {string} name workflow name.
 * @param {number} timeoutMs request timeout.
 * @returns {Promise<{ raw: any, converted: any, summary: any, name: string, revision: number }>}
 */
async function loadWorkflow(base, name, timeoutMs) {
  const raw = await fetchUserWorkflow(base, name, { timeoutMs });
  const revision = typeof raw?.revision === 'number' ? raw.revision : 0;
  const key = `${base}\u0000${name}`;
  const cached = workflowCache.get(key);
  if (cached !== undefined && cached.revision === revision && Date.now() - cached.at < WORKFLOW_TTL_MS) {
    return { raw, converted: cached.result, summary: summarizeWorkflow(raw), name, revision };
  }
  const types = collectNodeTypes(raw);
  const docs = new Map();
  await Promise.all(types.map(async (type) => {
    docs.set(type, await fetchObjectInfo(base, type, { timeoutMs }));
  }));
  const converted = convertWorkflow(raw, docs);
  if (workflowCache.size >= MAX_WORKFLOW_CACHE_ENTRIES) {
    const oldest = [...workflowCache.entries()].sort((left, right) => left[1].at - right[1].at)[0];
    if (oldest !== undefined) workflowCache.delete(oldest[0]);
  }
  workflowCache.set(key, { at: Date.now(), revision, result: converted });
  return { raw, converted, summary: summarizeWorkflow(raw), name, revision };
}

/**
 * Drop the cached list and conversion entries a saved or deleted workflow
 * invalidates, so the next `/workflows` and `/workflow` calls see the change.
 * @param {string} base normalised base URL.
 * @param {string} name workflow name.
 * @returns {void}
 */
function invalidateWorkflowCaches(base, name) {
  workflowCache.delete(`${base}\u0000${name}`);
  workflowListCache.delete(base);
}

const LORA_NODE_TYPES = new Set(['LoraLoader', 'LoraLoaderModelOnly']);

/**
 * Patch LoRA quick-edit rows onto a copy of a frontend workflow. Enabling or
 * disabling a LoRA is a canvas bypass toggle, so the graph is re-converted
 * afterwards instead of trying to patch the already-flattened API prompt.
 * @param {any} raw raw frontend workflow.
 * @param {any[]} loras quick-edit rows.
 * @returns {{ raw: any, changed: boolean }} patched graph and whether anything changed.
 */
export function applyLoraOverridesToRaw(raw, loras) {
  const entries = Array.isArray(loras) ? loras : [];
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const targets = [];
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue;
    const node = nodes.find((candidate) => String(candidate?.id) === String(entry.nodeId) && LORA_NODE_TYPES.has(String(candidate?.type)));
    if (node !== undefined) targets.push({ id: node.id, entry });
  }
  if (targets.length === 0) return { raw, changed: false };
  const clone = JSON.parse(JSON.stringify(raw));
  for (const { id, entry } of targets) {
    const target = clone.nodes.find((candidate) => String(candidate?.id) === String(id));
    if (target === undefined) continue;
    target.mode = entry.enabled === false ? 4 : 0;
    const values = Array.isArray(target.widgets_values) ? [...target.widgets_values] : [];
    const named = target.widgets_values_named !== null && typeof target.widgets_values_named === 'object' ? { ...target.widgets_values_named } : null;
    if (typeof entry.name === 'string' && entry.name !== '') {
      values[0] = entry.name;
      if (named !== null) named.lora_name = entry.name;
    }
    const model = Number(entry.model);
    if (entry.model !== undefined && entry.model !== null && Number.isFinite(model)) {
      values[1] = model;
      if (named !== null) named.strength_model = model;
    }
    const clip = Number(entry.clip);
    if (target.type === 'LoraLoader' && entry.clip !== undefined && entry.clip !== null && Number.isFinite(clip)) {
      values[2] = clip;
      if (named !== null) named.strength_clip = clip;
    }
    if (values.length > 0) target.widgets_values = values;
    if (named !== null) target.widgets_values_named = named;
  }
  return { raw: clone, changed: true };
}

/**
 * Convert a frontend workflow patched in memory.
 * @param {string} base normalised ComfyUI base URL.
 * @param {any} raw frontend workflow.
 * @param {number} timeoutMs upstream timeout.
 * @returns {Promise<any>} conversion result.
 */
async function convertRawWorkflow(base, raw, timeoutMs) {
  const types = collectNodeTypes(raw);
  const docs = new Map();
  await Promise.all(types.map(async (type) => {
    docs.set(type, await fetchObjectInfo(base, type, { timeoutMs }));
  }));
  return convertWorkflow(raw, docs);
}

/**
 * Ensure the official positive prefix is present, replacing generic boilerplate.
 * @param {string} text current prompt.
 * @param {string} prefix official prefix.
 * @returns {string} prompt with the official prefix.
 */
function withOfficialPrefix(text, prefix) {
  if (typeof text !== 'string') return text;
  if (text.toLowerCase().startsWith(prefix.trim().toLowerCase())) return text;
  const withoutBoilerplate = text.replace(/^masterpiece,\s*best quality(?:,\s*absurdres)?\.?\s*,?\s*/i, '');
  return prefix + withoutBoilerplate;
}

/**
 * Apply a workflow's official prompt preset (fixed negative and positive prefix).
 * @param {string} name workflow name.
 * @param {Record<string, any>} graph API prompt (mutated).
 * @param {any} params parameter surface (mutated when present).
 * @returns {void}
 */
function applyWorkflowPreset(name, graph, params) {
  const preset = WORKFLOW_PRESETS[name];
  if (preset === undefined) return;
  const negative = params?.negative;
  if (negative !== null && negative !== undefined) {
    const node = graph?.[negative.nodeId];
    if (node !== undefined && node !== null && node.inputs !== undefined) node.inputs.text = preset.negative;
    negative.text = preset.negative;
    if (params !== null && params !== undefined) params.negativeFixed = true;
  }
  const positive = params?.positive;
  if (positive !== null && positive !== undefined) {
    const node = graph?.[positive.nodeId];
    if (node !== undefined && node !== null && node.inputs !== undefined && typeof node.inputs.text === 'string') {
      node.inputs.text = withOfficialPrefix(node.inputs.text, preset.positivePrefix);
      positive.text = node.inputs.text;
    }
  }
}

/**
 * Build the single request handler the prefix route delegates to.
 * @param {ReturnType<typeof resolveConfig>} options runtime options.
 * @param {{ discover?: typeof discover, rewrite?: (input: unknown) => Promise<any>, progress?: any }} [deps] test seams.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} handler.
 */
export function createHandler(options, deps = {}) {
  const timeout = options.requestTimeoutMs;
  const discoverFn = typeof deps.discover === 'function' ? deps.discover : discover;
  const rewriteFn = typeof deps.rewrite === 'function' ? deps.rewrite : undefined;

  /**
   * @param {string} base normalised base URL.
   * @returns {Promise<Record<string, unknown>>} snapshot for the panel.
   */
  async function snapshot(base) {
    const capturedAt = new Date().toISOString();
    try {
      const [server, queue] = await Promise.all([
        probeSystem(base, { timeoutMs: timeout }),
        fetchQueue(base, { timeoutMs: timeout }),
      ]);
      let models = { checkpoints: [], samplers: [], schedulers: [] };
      try {
        models = await fetchModels(base, { timeoutMs: timeout });
      } catch {
        // the generation form stays disabled; the facts above are still useful
      }
      let outputs = [];
      try {
        outputs = await recentOutputs(base, 12, { timeoutMs: timeout });
      } catch {
        // recent outputs are decorative
      }
      return { ok: true, baseUrl: base, online: true, server, queue, models, outputs, capturedAt };
    } catch (error) {
      return { ok: true, baseUrl: base, online: false, error: messageOf(error), capturedAt };
    }
  }

  return async function handle(req, res) {
    if (!isTrusted(req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' });
      return;
    }
    let url;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid request URL' });
      return;
    }
    const pathname = url.pathname;
    if (pathname !== ROUTE_PREFIX && !pathname.startsWith(`${ROUTE_PREFIX}/`)) {
      sendJson(res, 404, { ok: false, error: 'not found' });
      return;
    }
    const sub = pathname.slice(ROUTE_PREFIX.length) === '' ? '/' : pathname.slice(ROUTE_PREFIX.length);
    const method = (req.method ?? 'GET').toUpperCase();
    try {
      switch (sub) {
        case '/health': {
          if (method !== 'GET') return methodNotAllowed(res);
          sendJson(res, 200, { ok: true, plugin: 'comfyui-panel', version: PLUGIN_VERSION, defaultBaseUrl: options.defaultBaseUrl });
          return;
        }
        case '/config': {
          if (method !== 'GET') return methodNotAllowed(res);
          sendJson(res, 200, {
            ok: true,
            plugin: 'comfyui-panel',
            version: PLUGIN_VERSION,
            defaultBaseUrl: options.defaultBaseUrl,
            discoveryPort: options.discoveryPort,
          });
          return;
        }
        case '/state': {
          if (method !== 'GET') return methodNotAllowed(res);
          let base;
          try {
            base = resolveBase(url.searchParams.get('base'), options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          sendJson(res, 200, await snapshot(base));
          return;
        }
        case '/live': {
          if (method !== 'GET') return methodNotAllowed(res);
          let base;
          try {
            base = resolveBase(url.searchParams.get('base'), options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          const capturedAt = new Date().toISOString();
          try {
            const [server, queue] = await Promise.all([
              probeSystem(base, { timeoutMs: timeout }),
              fetchQueue(base, { timeoutMs: timeout }),
            ]);
            deps.progress?.ensure?.(base);
            const progress = deps.progress?.snapshot?.(base) ?? null;
            sendJson(res, 200, { ok: true, online: true, baseUrl: base, server, queue, progress, capturedAt });
          } catch (error) {
            sendJson(res, 200, { ok: true, online: false, baseUrl: base, error: messageOf(error), capturedAt });
          }
          return;
        }
        case '/workflows': {
          if (method !== 'GET') return methodNotAllowed(res);
          let base;
          try {
            base = resolveBase(url.searchParams.get('base'), options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          try {
            const workflows = await cachedWorkflowList(base, timeout);
            sendJson(res, 200, { ok: true, baseUrl: base, workflows, capturedAt: new Date().toISOString() });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/workflow': {
          if (method !== 'GET') return methodNotAllowed(res);
          let base;
          try {
            base = resolveBase(url.searchParams.get('base'), options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          const name = url.searchParams.get('name') ?? '';
          try {
            const loaded = await loadWorkflow(base, name, timeout);
            applyWorkflowPreset(name, loaded.converted.prompt, loaded.converted.params);
            sendJson(res, 200, {
              ok: true,
              name,
              revision: loaded.revision,
              outputKind: loaded.converted.outputKind,
              supported: loaded.converted.supported,
              runnable: loaded.converted.supported,
              reasons: loaded.converted.reasons,
              warnings: loaded.converted.warnings,
              params: loaded.converted.params,
              cleanup: loaded.converted.cleanup,
              missingAssets: loaded.converted.missingAssets,
              modelKind: classifyModel(loaded.converted.params?.checkpoint),
              paramHints: modelParamHints(loaded.converted.params?.checkpoint),
              graph: loaded.raw,
              summary: loaded.summary,
            });
          } catch (error) {
            const cause = error instanceof ComfyUpstreamError ? error.status : null;
            sendJson(res, cause === 404 ? 404 : 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/object-info': {
          if (method !== 'GET') return methodNotAllowed(res);
          let base;
          try {
            base = resolveBase(url.searchParams.get('base'), options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          const types = parseObjectInfoTypes(url.searchParams.get('types'));
          if (types === null) {
            sendJson(res, 400, { ok: false, error: 'types must be 1-64 comma-separated node types (each 1-200 chars)' });
            return;
          }
          try {
            const docs = await Promise.all(types.map(async (type) => [type, await fetchObjectInfo(base, type, { timeoutMs: timeout })]));
            sendJson(res, 200, { ok: true, baseUrl: base, docs: Object.fromEntries(docs), capturedAt: new Date().toISOString() });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/node-catalog': {
          if (method !== 'GET') return methodNotAllowed(res);
          let base;
          try {
            base = resolveBase(url.searchParams.get('base'), options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          try {
            const catalog = await fetchNodeCatalog(base, { timeoutMs: timeout });
            sendJson(res, 200, { ok: true, baseUrl: base, catalog, capturedAt: new Date().toISOString() });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/workflows/save': {
          if (method !== 'POST') return methodNotAllowed(res);
          const body = await readBody(req, res, MAX_SAVE_BODY_BYTES);
          if (body === null) return;
          let name;
          try {
            name = normalizeWorkflowFileName(body.name);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          if (!isWorkflowGraph(body.graph)) {
            sendJson(res, 400, { ok: false, error: 'graph must be a workflow object with nodes and links arrays' });
            return;
          }
          const graph = /** @type {{ nodes: any[], links: any[] }} */ (body.graph);
          if (Buffer.byteLength(JSON.stringify(graph)) > MAX_SAVED_GRAPH_BYTES) {
            sendJson(res, 400, { ok: false, error: 'workflow graph is too large (limit 8 MB)' });
            return;
          }
          let base;
          try {
            base = resolveBase(body.base, options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          try {
            const savedName = await saveUserWorkflow(base, name, graph, { timeoutMs: Math.max(timeout, 20000) });
            invalidateWorkflowCaches(base, savedName);
            sendJson(res, 200, { ok: true, baseUrl: base, name: savedName });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/workflows/delete': {
          if (method !== 'POST') return methodNotAllowed(res);
          const body = await readBody(req, res);
          if (body === null) return;
          let name;
          try {
            name = normalizeWorkflowFileName(body.name);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          let base;
          try {
            base = resolveBase(body.base, options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          try {
            const deletedName = await deleteUserWorkflow(base, name, { timeoutMs: Math.max(timeout, 20000) });
            invalidateWorkflowCaches(base, deletedName);
            sendJson(res, 200, { ok: true, baseUrl: base, name: deletedName });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/generate': {
          if (method !== 'POST') return methodNotAllowed(res);
          const body = await readBody(req, res);
          if (body === null) return;
          let base;
          try {
            base = resolveBase(body.base, options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          const overrides = body.overrides !== null && typeof body.overrides === 'object' ? body.overrides : {};
          const name = typeof body.workflow === 'string' && body.workflow !== '' ? body.workflow : null;
          try {
            if (name === null) {
              const models = await fetchModels(base, { timeoutMs: timeout });
              const params = normalizeParams({
                ...overrides,
                checkpoint: typeof overrides.checkpoint === 'string' && overrides.checkpoint !== '' ? overrides.checkpoint : models.checkpoints[0],
              }, models);
              const graph = buildTxt2ImgGraph(params);
              const submitted = await submitGraph(base, graph, {
                timeoutMs: Math.max(timeout, 20000),
                clientId: deps.progress?.clientIdFor?.(base),
              });
              sendJson(res, 200, { ok: true, kind: 'builtin', ...submitted });
              return;
            }
            const loaded = await loadWorkflow(base, name, timeout);
            let converted = loaded.converted;
            let effective = overrides;
            if (Array.isArray(overrides.loras) && overrides.loras.length > 0) {
              const patched = applyLoraOverridesToRaw(loaded.raw, overrides.loras);
              if (patched.changed) {
                converted = await convertRawWorkflow(base, patched.raw, timeout);
                const { loras: _loras, ...rest } = overrides;
                effective = rest;
              }
            }
            if (!converted.supported) {
              sendJson(res, 400, {
                ok: false,
                error: converted.reasons.join('；') || '该工作流暂不支持',
                reasons: converted.reasons,
              });
              return;
            }
            let applied;
            try {
              applied = applyOverrides(converted, effective);
            } catch (error) {
              sendJson(res, 400, { ok: false, error: messageOf(error) });
              return;
            }
            applyWorkflowPreset(name, applied.prompt, converted.params);
            const submitted = await submitGraph(base, applied.prompt, {
              timeoutMs: Math.max(timeout, 20000),
              clientId: deps.progress?.clientIdFor?.(base),
            });
            sendJson(res, 200, { ok: true, kind: 'workflow', workflow: name, applied: applied.applied, ...submitted });
          } catch (error) {
            sendJson(res, 502, {
              ok: false,
              error: messageOf(error),
              nodeErrors: /** @type {any} */ (error)?.nodeErrors ?? null,
            });
          }
          return;
        }
        case '/rewrite': {
          if (method !== 'POST') return methodNotAllowed(res);
          const body = await readBody(req, res);
          if (body === null) return;
          try {
            if (rewriteFn === undefined) throw new Error('当前 profile 没有可用的 LLM 服务，无法做提示词转写');
            const result = await rewriteFn(body);
            sendJson(res, 200, { ok: true, ...result });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/job': {
          if (method !== 'GET') return methodNotAllowed(res);
          let base;
          try {
            base = resolveBase(url.searchParams.get('base'), options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          const id = url.searchParams.get('id') ?? '';
          if (id === '' || id.length > 200) {
            sendJson(res, 400, { ok: false, error: 'a prompt id is required' });
            return;
          }
          try {
            sendJson(res, 200, { ok: true, ...(await jobStatus(base, id, { timeoutMs: timeout })) });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/view': {
          if (method !== 'GET') return methodNotAllowed(res);
          let base;
          try {
            base = resolveBase(url.searchParams.get('base'), options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          try {
            const image = await viewImage(base, {
              filename: url.searchParams.get('filename'),
              subfolder: url.searchParams.get('subfolder') ?? '',
              type: url.searchParams.get('type') ?? 'output',
            });
            const filename = url.searchParams.get('filename') ?? 'image.png';
            const headers = url.searchParams.get('download') === '1'
              ? { 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }
              : {};
            sendBytes(res, 200, image.buffer, image.contentType, headers);
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/interrupt': {
          if (method !== 'POST') return methodNotAllowed(res);
          const body = await readBody(req, res);
          if (body === null) return;
          let base;
          try {
            base = resolveBase(body.base, options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          try {
            await interrupt(base, { timeoutMs: timeout });
            sendJson(res, 200, { ok: true });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/queue/clear': {
          if (method !== 'POST') return methodNotAllowed(res);
          const body = await readBody(req, res);
          if (body === null) return;
          let base;
          try {
            base = resolveBase(body.base, options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          try {
            await clearQueue(base, { timeoutMs: timeout });
            sendJson(res, 200, { ok: true });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: messageOf(error) });
          }
          return;
        }
        case '/connect': {
          if (method !== 'POST') return methodNotAllowed(res);
          const body = await readBody(req, res);
          if (body === null) return;
          let base;
          try {
            base = resolveBase(body.base, options.defaultBaseUrl);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: messageOf(error) });
            return;
          }
          try {
            const server = await probeSystem(base, { timeoutMs: timeout });
            sendJson(res, 200, { ok: true, baseUrl: base, online: true, server });
          } catch (error) {
            sendJson(res, 200, { ok: true, baseUrl: base, online: false, error: messageOf(error) });
          }
          return;
        }
        case '/discover': {
          if (method !== 'GET') return methodNotAllowed(res);
          const requestedPort = Number(url.searchParams.get('port'));
          const port = Number.isSafeInteger(requestedPort) && requestedPort >= 1 && requestedPort <= 65535
            ? requestedPort
            : options.discoveryPort;
          try {
            const result = await cachedDiscovery(port, options, discoverFn);
            sendJson(res, 200, { ok: true, port, ...result });
          } catch (error) {
            sendJson(res, 500, { ok: false, error: messageOf(error) });
          }
          return;
        }
        default:
          sendJson(res, 404, { ok: false, error: 'not found' });
      }
    } catch (error) {
      sendJson(res, 500, { ok: false, error: messageOf(error) });
    }
  };
}

/**
 * Host plugin entry: register the studio routes while `webServer` exists.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host plugin context.
 * @param {Record<string, unknown> | undefined} config patch row config.
 * @returns {void}
 */
export function apply(ctx, config) {
  const options = resolveConfig(config);
  const progress = createProgressTracker();
  ctx.effect(() => () => progress.close(), 'comfyui-panel: progress');
  const handler = createHandler(options, {
    rewrite: (input) => rewritePrompt(ctx, options, input),
    progress,
  });
  // `webServer` is optional: profiles without the Web carrier still load the row.
  ctx.inject(['webServer'], (scoped) => {
    const webServer = scoped.webServer;
    if (webServer === undefined || typeof webServer.register !== 'function') return;
    const dispose = webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler });
    scoped.effect(() => () => dispose(), 'comfyui-panel: routes');
  });
}

/** Internal helpers exposed for unit tests (not part of the plugin contract). */
export const __testing = {
  resolveConfig,
  isTrusted,
  sanitizeRewrite,
  DEFAULT_BASE_URL,
  ROUTE_PREFIX,
};
