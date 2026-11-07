/**
 * dsh-comfyui-panel — ComfyUI upstream client.
 *
 * Everything the Host half needs to talk to a ComfyUI server on the LAN:
 * URL normalisation, small JSON/byte HTTP calls with timeouts, the txt2img API
 * graph, parameter validation, queue/history parsing, image proxying, and a
 * bounded LAN discovery scan. No cordis import lives here, so this module is
 * directly unit-testable and runnable from scripts.
 */
import { networkInterfaces } from 'node:os';

/** Plugin row / panel id shared by both halves. */
export const PLUGIN_ID = 'comfyui-panel';
/** Package name; the Client loader id must equal it. */
export const PACKAGE_NAME = 'dsh-comfyui-studio';
/** Version reported by health routes. */
export const PLUGIN_VERSION = '0.3.1';

const DEFAULT_TIMEOUT_MS = 8000;
const VIEW_TIMEOUT_MS = 30000;
const MAX_VIEW_BYTES = 64 * 1024 * 1024;
const MAX_HISTORY_BYTES = 32 * 1024 * 1024;
const MAX_PROMPT_CHARS = 4000;
const MAX_BASE_URL_CHARS = 300;
const MODEL_CACHE_TTL_MS = 60000;
const MAX_DISCOVERY_HOSTS = 512;
const IMAGE_TYPES = new Set(['output', 'input', 'temp']);

/** Thrown for any HTTP-level ComfyUI failure, carrying the upstream body when parsed. */
export class ComfyUpstreamError extends Error {
  /**
   * @param {string} message readable message.
   * @param {{ status?: number, body?: unknown }} [detail] upstream status/body.
   */
  constructor(message, detail = {}) {
    super(message);
    this.name = 'ComfyUpstreamError';
    this.status = detail.status ?? null;
    this.body = detail.body ?? null;
  }
}

/** Small per-base cache of the model lists (object_info node queries). */
const modelCache = new Map();

/** Drop the model cache (tests). */
export function clearModelCache() {
  modelCache.clear();
}

/**
 * Normalise a user-entered server address into an origin (+ optional path).
 *
 * Accepts `127.0.0.1:8188`, `http://127.0.0.1:8188/`, and a sub-path
 * deployment such as `http://host:8188/comfyui` (the ComfyUI base path). Query,
 * hash, credentials and trailing slashes are rejected/stripped because every
 * upstream route is appended to this value.
 *
 * @param {unknown} input raw user/config value.
 * @returns {string} normalised base URL without a trailing slash.
 */
export function normalizeBaseUrl(input) {
  if (typeof input !== 'string') throw new Error('server address is required');
  const trimmed = input.trim();
  if (trimmed === '') throw new Error('server address is required');
  if (trimmed.length > MAX_BASE_URL_CHARS) throw new Error('server address is too long');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error('server address is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('only http:// and https:// server addresses are supported');
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('server address must not contain credentials');
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error('server address must not contain a query string or hash');
  }
  if (url.hostname === '') throw new Error('server address is missing a host');
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path === '/' ? '' : path}`;
}

/**
 * Open a request against `base + path` with a hard timeout.
 * @param {string} base normalised base URL.
 * @param {string} path absolute path (starts with `/`).
 * @param {{ method?: string, body?: unknown, timeoutMs?: number, signal?: AbortSignal, accept?: string }} [options]
 * @returns {Promise<{ response: Response, dispose: () => void }>} live response plus cleanup.
 */
async function open(base, path, options = {}) {
  const url = `${base}${path}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  const external = options.signal;
  if (external !== undefined) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onAbort, { once: true });
  }
  const dispose = () => {
    clearTimeout(timer);
    if (external !== undefined) external.removeEventListener('abort', onAbort);
  };
  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        accept: options.accept ?? 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      redirect: 'error',
    });
    return { response, dispose };
  } catch (error) {
    dispose();
    throw describeFetchError(error, url, timeoutMs, timedOut);
  }
}

/**
 * Turn a fetch rejection into an actionable message.
 * @param {unknown} error thrown value.
 * @param {string} url requested URL.
 * @param {number} timeoutMs timeout used.
 * @param {boolean} timedOut whether our timer fired.
 * @returns {Error} readable error.
 */
function describeFetchError(error, url, timeoutMs, timedOut) {
  if (timedOut) return new Error(`ComfyUI request timed out after ${timeoutMs} ms (${url})`);
  const cause = /** @type {any} */ (error)?.cause;
  const code = cause?.code ?? /** @type {any} */ (error)?.code;
  if (code === 'ECONNREFUSED') return new Error(`ComfyUI refused the connection (${url}). Is ComfyUI running and listening on that port?`);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new Error(`ComfyUI host not found (${url}). Check the address.`);
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return new Error(`ComfyUI host is unreachable (${url}). Are both devices on the same network?`);
  if (code === 'ECONNRESET') return new Error(`ComfyUI closed the connection (${url}).`);
  if (code === 'ERR_INVALID_URL') return new Error(`invalid ComfyUI address (${url}).`);
  return new Error(`cannot reach ComfyUI at ${url}: ${cause?.message ?? /** @type {any} */ (error)?.message ?? String(error)}`);
}

/**
 * Parse a response body as JSON, translating HTTP failures.
 * @param {Response} response fetch response.
 * @param {number} maxBytes accepted body size.
 * @returns {Promise<unknown>} parsed JSON (`{}` for an empty body).
 */
async function readJson(response, maxBytes = MAX_HISTORY_BYTES) {
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error('ComfyUI response was too large');
  const text = buffer.toString('utf8').trim();
  if (text === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ComfyUpstreamError(`ComfyUI returned a non-JSON response (HTTP ${response.status})`, { status: response.status });
  }
  if (!response.ok) throw upstreamErrorOf(parsed, response.status);
  return parsed;
}

/**
 * Build an error from a ComfyUI error body.
 * @param {unknown} body parsed JSON body.
 * @param {number} status HTTP status.
 * @returns {ComfyUpstreamError} error with the upstream body attached.
 */
function upstreamErrorOf(body, status) {
  const record = body !== null && typeof body === 'object' ? /** @type {any} */ (body) : {};
  const raw = record.error;
  const message = raw !== null && typeof raw === 'object' ? raw.message ?? raw.type : typeof raw === 'string' ? raw : '';
  return new ComfyUpstreamError(String(message !== '' ? message : `ComfyUI returned HTTP ${status}`), { status, body });
}

/**
 * GET a JSON document from ComfyUI.
 * @param {string} base normalised base URL.
 * @param {string} path upstream path.
 * @param {{ timeoutMs?: number, signal?: AbortSignal, maxBytes?: number }} [options]
 * @returns {Promise<any>} parsed JSON.
 */
export function getJson(base, path, options = {}) {
  return open(base, path, options).then(async ({ response, dispose }) => {
    try {
      return await readJson(response, options.maxBytes);
    } finally {
      dispose();
    }
  });
}

/**
 * POST a JSON body to ComfyUI.
 * @param {string} base normalised base URL.
 * @param {string} path upstream path.
 * @param {unknown} body JSON body.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<any>} parsed JSON.
 */
export function postJson(base, path, body, options = {}) {
  return open(base, path, {
    method: 'POST',
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    body: body ?? {},
  }).then(async ({ response, dispose }) => {
    try {
      return await readJson(response, options.maxBytes);
    } finally {
      dispose();
    }
  });
}

/**
 * GET raw bytes from ComfyUI.
 * @param {string} base normalised base URL.
 * @param {string} path upstream path (already query-encoded).
 * @param {{ timeoutMs?: number, signal?: AbortSignal, maxBytes?: number }} [options]
 * @returns {Promise<{ contentType: string, buffer: Buffer }>} bytes and content type.
 */
export async function getBytes(base, path, options = {}) {
  const { response, dispose } = await open(base, path, {
    timeoutMs: options.timeoutMs ?? VIEW_TIMEOUT_MS,
    signal: options.signal,
    accept: '*/*',
  });
  try {
    const status = response.status;
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const declared = Number(response.headers.get('content-length') ?? '0');
    const limit = options.maxBytes ?? MAX_VIEW_BYTES;
    if (declared > limit) throw new Error('image is too large');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > limit) throw new Error('image is too large');
    if (!response.ok) {
      let detail = `ComfyUI returned HTTP ${status}`;
      try {
        const parsed = JSON.parse(buffer.toString('utf8'));
        detail = String(parsed?.error?.message ?? parsed?.error ?? detail);
      } catch {
        // keep the HTTP status text
      }
      throw new ComfyUpstreamError(detail, { status });
    }
    return { contentType, buffer };
  } finally {
    dispose();
  }
}

/**
 * Read `/system_stats` and shape the device/server facts the panel shows.
 * @param {string} base normalised base URL.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ version: string, os: string, python: string, pytorch: string, ramTotal: number | null, ramFree: number | null, devices: Array<{ name: string, type: string | null, vramTotal: number | null, vramFree: number | null }> }>}
 */
export async function probeSystem(base, options = {}) {
  const raw = await getJson(base, '/system_stats', options);
  const system = raw !== null && typeof raw === 'object' ? raw.system ?? {} : {};
  const devices = Array.isArray(raw?.devices)
    ? raw.devices.map((device) => ({
      name: String(device?.name ?? ''),
      type: device?.type === undefined || device?.type === null ? null : String(device.type),
      vramTotal: finiteOrNull(device?.vram_total),
      vramFree: finiteOrNull(device?.vram_free),
    }))
    : [];
  return {
    version: String(system.comfyui_version ?? ''),
    os: String(system.os ?? ''),
    python: String(system.python_version ?? ''),
    pytorch: String(system.pytorch_version ?? ''),
    ramTotal: finiteOrNull(system.ram_total),
    ramFree: finiteOrNull(system.ram_free),
    devices,
  };
}

/**
 * @param {unknown} value candidate number.
 * @returns {number | null} finite number or null.
 */
function finiteOrNull(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Read the model lists the generation form offers.
 * @param {string} base normalised base URL.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ checkpoints: string[], samplers: string[], schedulers: string[] }>}
 */
export async function fetchModels(base, options = {}) {
  const cached = modelCache.get(base);
  if (cached !== undefined && Date.now() - cached.at < MODEL_CACHE_TTL_MS) return cached.value;
  const [checkpointNode, samplerNode] = await Promise.all([
    getJson(base, '/object_info/CheckpointLoaderSimple', options),
    getJson(base, '/object_info/KSampler', options),
  ]);
  const value = {
    checkpoints: comboList(checkpointNode, 'CheckpointLoaderSimple', 'ckpt_name'),
    samplers: comboList(samplerNode, 'KSampler', 'sampler_name'),
    schedulers: comboList(samplerNode, 'KSampler', 'scheduler'),
  };
  modelCache.set(base, { at: Date.now(), value });
  return value;
}

/**
 * Extract a combo input's option list from an `/object_info/<node>` document.
 * @param {any} document object_info node document.
 * @param {string} node node class name.
 * @param {string} input required input name.
 * @returns {string[]} option strings.
 */
function comboList(document, node, input) {
  const options = document?.[node]?.input?.required?.[input]?.[0];
  return Array.isArray(options) ? options.filter((entry) => typeof entry === 'string') : [];
}

/**
 * Read the queue and normalise its two lists.
 * @param {string} base normalised base URL.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ running: number, pending: number, runningIds: string[], pendingIds: string[] }>}
 */
export async function fetchQueue(base, options = {}) {
  const raw = await getJson(base, '/queue', options);
  const running = Array.isArray(raw?.queue_running) ? raw.queue_running : [];
  const pending = Array.isArray(raw?.queue_pending) ? raw.queue_pending : [];
  return {
    running: running.length,
    pending: pending.length,
    runningIds: running.map(promptIdOfQueueEntry).filter((id) => id !== ''),
    pendingIds: pending.map(promptIdOfQueueEntry).filter((id) => id !== ''),
  };
}

/**
 * Queue entries are `[number, prompt_id, prompt, ...]` on classic ComfyUI and
 * objects on some forks; accept both.
 * @param {unknown} entry one queue item.
 * @returns {string} prompt id or an empty string.
 */
function promptIdOfQueueEntry(entry) {
  if (Array.isArray(entry)) return typeof entry[1] === 'string' ? entry[1] : '';
  if (entry !== null && typeof entry === 'object') {
    const id = /** @type {any} */ (entry).prompt_id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

/**
 * Extract every output image from one history entry.
 * @param {unknown} entry one `/history` entry.
 * @returns {Array<{ filename: string, subfolder: string, type: string }>} images.
 */
export function historyImages(entry) {
  const outputs = entry !== null && typeof entry === 'object' ? /** @type {any} */ (entry).outputs : null;
  if (outputs === null || typeof outputs !== 'object') return [];
  const images = [];
  for (const nodeOutput of Object.values(outputs)) {
    if (nodeOutput === null || typeof nodeOutput !== 'object') continue;
    const list = /** @type {any} */ (nodeOutput).images;
    if (!Array.isArray(list)) continue;
    for (const image of list) {
      if (image === null || typeof image !== 'object' || typeof image.filename !== 'string') continue;
      images.push({
        filename: image.filename,
        subfolder: typeof image.subfolder === 'string' ? image.subfolder : '',
        type: typeof image.type === 'string' ? image.type : 'output',
      });
    }
  }
  return images;
}

/**
 * Describe why a history entry failed, if it did.
 * @param {unknown} entry one `/history` entry.
 * @returns {string | null} failure text.
 */
export function historyFailure(entry) {
  const status = entry !== null && typeof entry === 'object' ? /** @type {any} */ (entry).status : null;
  if (status === null || typeof status !== 'object') return null;
  if (status.status_str !== 'error' && status.completed !== false) return null;
  const messages = Array.isArray(status.messages) ? status.messages : [];
  for (const message of messages) {
    if (!Array.isArray(message) || message[0] !== 'execution_error') continue;
    const detail = message[1] ?? {};
    const text = detail.exception_message ?? detail.exception_type ?? '';
    if (typeof text === 'string' && text.trim() !== '') return text.trim();
  }
  return status.status_str === 'error' ? 'ComfyUI reported an execution error' : null;
}

/**
 * Map a history entry to a job outcome.
 * @param {unknown} entry one `/history` entry.
 * @returns {{ status: 'completed' | 'error', images: Array<{ filename: string, subfolder: string, type: string }>, error?: string }}
 */
export function historyOutcome(entry) {
  const failure = historyFailure(entry);
  if (failure !== null) return { status: 'error', images: [], error: failure };
  return { status: 'completed', images: historyImages(entry), seed: historySeed(entry) };
}

/**
 * Find the seed recorded in a history entry's API prompt (KSampler, random
 * noise and similar nodes all use `seed` or `noise_seed`).
 * @param {unknown} entry one `/history` entry.
 * @returns {number | null} submitted seed when the history kept the prompt.
 */
export function historySeed(entry) {
  const prompt = entry !== null && typeof entry === 'object'
    ? (Array.isArray(/** @type {any} */ (entry).prompt) ? /** @type {any} */ (entry).prompt[2] : /** @type {any} */ (entry).prompt)
    : null;
  if (prompt === null || typeof prompt !== 'object') return null;
  for (const node of Object.values(prompt)) {
    if (node === null || typeof node !== 'object') continue;
    const inputs = /** @type {any} */ (node).inputs;
    if (inputs === null || typeof inputs !== 'object') continue;
    for (const name of ['seed', 'noise_seed']) {
      const number = Number(inputs[name]);
      if (Number.isFinite(number) && number >= 0) return number;
    }
  }
  return null;
}

/**
 * Read the most recent completed outputs (newest first).
 * @param {string} base normalised base URL.
 * @param {number} limit maximum entries to return.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<Array<{ promptId: string, images: Array<{ filename: string, subfolder: string, type: string }> }>>}
 */
export async function recentOutputs(base, limit = 12, options = {}) {
  const raw = await getJson(base, `/history?max_items=${Math.max(1, Math.min(50, limit))}`, options);
  if (raw === null || typeof raw !== 'object') return [];
  const entries = Object.entries(raw);
  const outputs = [];
  for (const [promptId, entry] of entries) {
    const images = historyImages(entry);
    if (images.length === 0) continue;
    outputs.push({ promptId, images, seed: historySeed(entry) });
  }
  return outputs.reverse().slice(0, limit);
}

/**
 * Validate and normalise the generation form into the values the graph needs.
 * @param {unknown} input raw params from the client.
 * @param {{ checkpoints: string[], samplers: string[], schedulers: string[] }} models server model lists.
 * @returns {{ checkpoint: string, positive: string, negative: string, width: number, height: number, steps: number, cfg: number, seed: number, batchSize: number, sampler: string, scheduler: string }}
 */
export function normalizeParams(input, models) {
  const raw = input !== null && typeof input === 'object' ? /** @type {any} */ (input) : {};
  const checkpoints = Array.isArray(models?.checkpoints) ? models.checkpoints : [];
  if (checkpoints.length === 0) throw new Error('the ComfyUI server reports no checkpoint models');
  const checkpoint = typeof raw.checkpoint === 'string' ? raw.checkpoint.trim() : '';
  if (checkpoint === '') throw new Error('a checkpoint model is required');
  if (!checkpoints.includes(checkpoint)) throw new Error(`checkpoint "${checkpoint}" is not installed on the ComfyUI server`);
  const positive = textField(raw.positive, 'prompt');
  const negative = textField(raw.negative, 'negative prompt');
  const width = dimension(raw.width, 'width');
  const height = dimension(raw.height, 'height');
  const steps = integerInRange(raw.steps, 'steps', 1, 100);
  const cfg = numberInRange(raw.cfg, 'CFG', 0, 30);
  const seed = integerInRange(raw.seed, 'seed', 0, Number.MAX_SAFE_INTEGER);
  const batchSize = integerInRange(raw.batchSize, 'batch size', 1, 4);
  const samplers = Array.isArray(models?.samplers) ? models.samplers : [];
  const schedulers = Array.isArray(models?.schedulers) ? models.schedulers : [];
  const sampler = choice(raw.sampler, 'sampler', samplers, 'euler');
  const scheduler = choice(raw.scheduler, 'scheduler', schedulers, 'normal');
  return { checkpoint, positive, negative, width, height, steps, cfg, seed, batchSize, sampler, scheduler };
}

/**
 * @param {unknown} value raw text.
 * @param {string} name field name for the error.
 * @returns {string} trimmed text within the cap.
 */
function textField(value, name) {
  const text = typeof value === 'string' ? value : '';
  if (text.length > MAX_PROMPT_CHARS) throw new Error(`${name} must be at most ${MAX_PROMPT_CHARS} characters`);
  return text;
}

/**
 * @param {unknown} value raw dimension.
 * @param {string} name field name.
 * @returns {number} multiple of 8 in [64, 2048].
 */
function dimension(value, name) {
  const number = integerInRange(value, name, 64, 2048);
  if (number % 8 !== 0) throw new Error(`${name} must be a multiple of 8`);
  return number;
}

/**
 * @param {unknown} value raw value.
 * @param {string} name field name.
 * @param {number} min minimum.
 * @param {number} max maximum.
 * @returns {number} integer in range.
 */
function integerInRange(value, name, min, max) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return number;
}

/**
 * @param {unknown} value raw value.
 * @param {string} name field name.
 * @param {number} min minimum.
 * @param {number} max maximum.
 * @returns {number} number in range.
 */
function numberInRange(value, name, min, max) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return number;
}

/**
 * @param {unknown} value requested choice.
 * @param {string} name field name.
 * @param {string[]} allowed server options.
 * @param {string} fallback value used when the request omits the field.
 * @returns {string} the validated choice.
 */
function choice(value, name, allowed, fallback) {
  const requested = typeof value === 'string' && value !== '' ? value : fallback;
  if (allowed.length > 0 && !allowed.includes(requested)) throw new Error(`${name} "${requested}" is not offered by the ComfyUI server`);
  return requested;
}

/**
 * Build the classic txt2img API graph.
 * @param {ReturnType<typeof normalizeParams>} params normalised parameters.
 * @returns {Record<string, { class_type: string, inputs: Record<string, unknown> }>} API prompt graph.
 */
export function buildTxt2ImgGraph(params) {
  return {
    3: {
      class_type: 'KSampler',
      inputs: {
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        sampler_name: params.sampler,
        scheduler: params.scheduler,
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: params.checkpoint } },
    5: { class_type: 'EmptyLatentImage', inputs: { width: params.width, height: params.height, batch_size: params.batchSize } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: params.positive, clip: ['4', 1] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: params.negative, clip: ['4', 1] } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    9: { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'dsh-comfy' } },
  };
}

/**
 * Submit one generation to ComfyUI.
 * @param {string} base normalised base URL.
 * @param {ReturnType<typeof normalizeParams>} params normalised parameters.
 * @param {{ timeoutMs?: number, signal?: AbortSignal, clientId?: string }} [options]
 * @returns {Promise<{ promptId: string, number: number | null, nodeErrors: Record<string, unknown> | null }>}
 */
export async function submitPrompt(base, params, options = {}) {
  const graph = buildTxt2ImgGraph(params);
  let response;
  try {
    response = await postJson(base, '/prompt', { prompt: graph, client_id: options.clientId ?? randomId() }, {
      timeoutMs: options.timeoutMs ?? 15000,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof ComfyUpstreamError && error.body !== null && typeof error.body === 'object') {
      const body = /** @type {any} */ (error.body);
      const nodeErrors = body.node_errors !== null && typeof body.node_errors === 'object' ? body.node_errors : null;
      const enriched = new ComfyUpstreamError(error.message, { status: error.status, body: error.body });
      /** @type {any} */ (enriched).nodeErrors = nodeErrors;
      throw enriched;
    }
    throw error;
  }
  const promptId = typeof response?.prompt_id === 'string' ? response.prompt_id : '';
  if (promptId === '') throw new Error('ComfyUI did not return a prompt id');
  return {
    promptId,
    number: Number.isFinite(Number(response?.number)) ? Number(response.number) : null,
    nodeErrors: response?.node_errors !== null && typeof response?.node_errors === 'object' ? response.node_errors : null,
  };
}

/**
 * @returns {string} a random id usable as `client_id`.
 */
function randomId() {
  return `dsh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Poll one submitted prompt's outcome.
 * @param {string} base normalised base URL.
 * @param {string} promptId prompt id returned by `/prompt`.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ status: 'queued' | 'running' | 'completed' | 'error' | 'missing', position?: number, images?: Array<{ filename: string, subfolder: string, type: string }>, error?: string }>}
 */
export async function jobStatus(base, promptId, options = {}) {
  const history = await getJson(base, `/history/${encodeURIComponent(promptId)}`, options);
  const entry = history !== null && typeof history === 'object' ? /** @type {any} */ (history)[promptId] : undefined;
  if (entry !== undefined) return historyOutcome(entry);
  const queue = await fetchQueue(base, options);
  if (queue.runningIds.includes(promptId)) return { status: 'running' };
  const position = queue.pendingIds.indexOf(promptId);
  if (position >= 0) return { status: 'queued', position: position + 1 };
  return { status: 'missing' };
}

/**
 * Ask ComfyUI to interrupt the running job.
 * @param {string} base normalised base URL.
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<void>}
 */
export async function interrupt(base, options = {}) {
  await postJson(base, '/interrupt', {}, options);
}

/**
 * Clear the pending queue (the running job is not affected).
 * @param {string} base normalised base URL.
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<void>}
 */
export async function clearQueue(base, options = {}) {
  await postJson(base, '/queue', { clear: true }, options);
}

/**
 * Fetch one output image through the Host proxy.
 * @param {string} base normalised base URL.
 * @param {{ filename: unknown, subfolder?: unknown, type?: unknown }} image image coordinates.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ contentType: string, buffer: Buffer }>} image bytes.
 */
export async function viewImage(base, image, options = {}) {
  const filename = typeof image?.filename === 'string' ? image.filename.trim() : '';
  if (filename === '' || filename.length > 500) throw new Error('image filename is invalid');
  if (filename.includes('..') || filename.includes('\0') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('image filename is invalid');
  }
  const subfolder = typeof image?.subfolder === 'string' ? image.subfolder : '';
  if (subfolder.length > 500 || subfolder.includes('..') || subfolder.includes('\0') || subfolder.includes('\\') || subfolder.startsWith('/')) {
    throw new Error('image subfolder is invalid');
  }
  const type = typeof image?.type === 'string' && IMAGE_TYPES.has(image.type) ? image.type : 'output';
  const query = new URLSearchParams({ filename, subfolder, type });
  const result = await getBytes(base, `/view?${query.toString()}`, {
    timeoutMs: options.timeoutMs ?? VIEW_TIMEOUT_MS,
    signal: options.signal,
  });
  if (!result.contentType.startsWith('image/')) throw new Error('ComfyUI did not return an image');
  return result;
}

/**
 * Build the candidate origin list for a /24 scan of every local IPv4 interface.
 * @param {{ port?: number, include?: string[], maxHosts?: number }} [options]
 * @returns {string[]} candidate base URLs.
 */
export function candidateBaseUrls(options = {}) {
  const port = Number.isSafeInteger(options.port) ? options.port : 8188;
  const maxHosts = Number.isSafeInteger(options.maxHosts) ? options.maxHosts : MAX_DISCOVERY_HOSTS;
  const candidates = [];
  const seen = new Set();
  const push = (base) => {
    if (candidates.length >= maxHosts) return;
    if (seen.has(base)) return;
    seen.add(base);
    candidates.push(base);
  };
  for (const base of options.include ?? []) {
    try {
      push(normalizeBaseUrl(base));
    } catch {
      // an invalid include entry is not a discovery candidate
    }
  }
  // Loopback first: a local ComfyUI (Comfy Desktop, `python main.py`) is common
  // and always the cheapest candidate to probe.
  push(`http://127.0.0.1:${port}`);
  push(`http://localhost:${port}`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      const octets = address.address.split('.');
      if (octets.length !== 4) continue;
      if (address.address.startsWith('169.254.')) continue;
      const prefix = octets.slice(0, 3).join('.');
      push(`http://${prefix}.${octets[3]}:${port}`);
      for (let last = 1; last <= 254; last += 1) push(`http://${prefix}.${last}:${port}`);
    }
  }
  return candidates;
}

/**
 * Scan the local /24 subnets for ComfyUI servers, bounded in time and parallelism.
 * @param {{ port?: number, timeoutMs?: number, concurrency?: number, include?: string[], signal?: AbortSignal }} [options]
 * @returns {Promise<{ found: Array<{ baseUrl: string, version: string, gpu: string, os: string }>, scanned: number, durationMs: number }>}
 */
export async function discover(options = {}) {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 1200;
  const concurrency = Math.max(1, Math.min(64, options.concurrency ?? 32));
  const candidates = candidateBaseUrls(options);
  const found = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, async () => {
    while (cursor < candidates.length) {
      if (options.signal?.aborted === true) return;
      const base = candidates[cursor];
      cursor += 1;
      try {
        const server = await probeSystem(base, { timeoutMs, signal: options.signal });
        found.push({
          baseUrl: base,
          version: server.version,
          gpu: server.devices.length > 0 ? server.devices[0].name : '',
          os: server.os,
        });
      } catch {
        // not a ComfyUI server, or not reachable; expected for most candidates
      }
    }
  });
  await Promise.all(workers);
  found.sort((left, right) => left.baseUrl.localeCompare(right.baseUrl, 'en', { numeric: true }));
  return { found, scanned: candidates.length, durationMs: Date.now() - started };
}
