/**
 * ComfyUI UI-workflow → API-prompt conversion.
 *
 * ComfyUI's saved workflows (`/userdata?dir=workflows`) are frontend graphs
 * (`nodes` + `links` + widget values), while `/prompt` accepts API graphs
 * (`{ id: { class_type, inputs } }`). This module performs the same translation
 * the ComfyUI frontend does when it queues a prompt, for the node kinds the
 * studio panel supports, and extracts the editable prompt/parameter surface.
 *
 * Unsupported constructs (subgraphs, unknown custom nodes, missing required
 * links, video-only outputs) are reported instead of guessed, so the panel can
 * disable generation with a concrete reason.
 */

/** Nodes that only exist in the frontend and must never reach `/prompt`. */
const UI_ONLY_TYPES = new Set([
  'Note',
  'MarkdownNote',
  'Reroute',
  'PrimitiveNode',
  'GroupNode',
  'Label (rgthree)',
  'Bookmark (rgthree)',
]);

/** Object-info types the frontend renders as widgets rather than link sockets. */
const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']);

/** Values ComfyUI's `control_after_generate` widget can hold. */
const CONTROL_VALUES = new Set(['fixed', 'increment', 'decrement', 'randomize']);

/** Identifier of the panel's built-in text-to-image workflow. */
export const BUILTIN_WORKFLOW_ID = '__builtin__';

/** ComfyUI's official text-to-image defaults (used by the built-in workflow). */
export const OFFICIAL_DEFAULTS = Object.freeze({
  steps: 20,
  cfg: 8,
  sampler: 'euler',
  scheduler: 'normal',
  width: 512,
  height: 512,
  batchSize: 1,
  denoise: 1,
});

/**
 * Cheap classification of a saved workflow before any `/object_info` lookup.
 * @param {any} raw parsed workflow JSON.
 * @returns {{ nodeCount: number, hasSubgraph: boolean, outputKind: 'image' | 'video' | 'unknown', runnable: boolean, reasons: string[] }}
 */
export function summarizeWorkflow(raw) {
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const types = nodes
    .filter((node) => node !== null && typeof node === 'object')
    .map((node) => String(node.type ?? ''));
  const hasSubgraph = hasSubgraphDefinition(raw) || types.some((type) => isUuid(type));
  const hasVideo = types.some((type) => type === 'SaveVideo' || type === 'SaveAnimatedWEBP' || type === 'VHS_VideoCombine');
  const hasImage = types.some((type) => type === 'SaveImage' || type === 'PreviewImage');
  const outputKind = hasImage ? 'image' : hasVideo ? 'video' : 'unknown';
  const reasons = [];
  if (hasSubgraph) reasons.push('工作流包含子图（subgraph），当前不支持');
  if (!hasImage && hasVideo) reasons.push('工作流输出视频，当前面板只支持图片输出');
  if (!hasImage && !hasVideo) reasons.push('工作流没有可识别的图片输出节点（SaveImage / PreviewImage）');
  return {
    nodeCount: nodes.length,
    hasSubgraph,
    outputKind,
    runnable: !hasSubgraph && outputKind === 'image',
    reasons,
  };
}

/**
 * @param {any} raw workflow JSON.
 * @returns {boolean} whether the document defines frontend subgraphs.
 */
function hasSubgraphDefinition(raw) {
  return raw !== null && typeof raw === 'object'
    && raw.definitions !== null && typeof raw.definitions === 'object'
    && Array.isArray(raw.definitions.subgraphs) && raw.definitions.subgraphs.length > 0;
}

/**
 * @param {string} type node type.
 * @returns {boolean} whether the type looks like a frontend subgraph UUID.
 */
function isUuid(type) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(type);
}

/**
 * The node types whose `/object_info` documents the converter needs.
 * @param {any} raw workflow JSON.
 * @returns {string[]} unique API node types.
 */
export function collectNodeTypes(raw) {
  const types = new Set();
  for (const node of Array.isArray(raw?.nodes) ? raw.nodes : []) {
    if (node === null || typeof node !== 'object') continue;
    const type = String(node.type ?? '');
    if (type === '' || UI_ONLY_TYPES.has(type) || isUuid(type)) continue;
    if (node.mode === 2 || node.mode === 4) continue;
    types.add(type);
  }
  return [...types];
}

/**
 * @param {unknown} spec object-info input spec.
 * @returns {boolean} whether the spec is a widget (has an inline value).
 */
function isWidgetSpec(spec) {
  if (!Array.isArray(spec) || spec.length === 0) return false;
  if (Array.isArray(spec[0])) return true;
  return typeof spec[0] === 'string' && WIDGET_TYPES.has(spec[0]);
}

/**
 * @param {unknown} spec object-info input spec.
 * @returns {boolean} whether the input carries a `control_after_generate` widget.
 */
function hasSeedControl(spec) {
  if (!Array.isArray(spec) || spec.length < 2) return false;
  const options = spec[1];
  return options !== null && typeof options === 'object' && options.control_after_generate === true;
}

/**
 * Ordered widget inputs declared by one node document.
 * @param {any} doc `/object_info/<type>` document.
 * @returns {Array<{ name: string, spec: unknown, required: boolean }>} widget inputs.
 */
function widgetSpecs(doc) {
  const result = [];
  for (const section of ['required', 'optional']) {
    const inputs = doc?.input?.[section];
    if (inputs === null || typeof inputs !== 'object') continue;
    for (const [name, spec] of Object.entries(inputs)) {
      if (!isWidgetSpec(spec)) continue;
      if (Array.isArray(spec) && spec.length >= 2 && spec[1] !== null && typeof spec[1] === 'object' && spec[1].forceInput === true) continue;
      result.push({ name, spec, required: section === 'required' });
    }
  }
  return result;
}

/**
 * Build the link table for both link encodings ComfyUI has used.
 * @param {any} raw workflow JSON.
 * @returns {Map<number, { originId: number, originSlot: number, type: string | null }>}
 */
function linkTable(raw) {
  const table = new Map();
  for (const link of Array.isArray(raw?.links) ? raw.links : []) {
    if (Array.isArray(link)) {
      table.set(link[0], { originId: link[1], originSlot: link[2], type: typeof link[5] === 'string' ? link[5] : null });
    } else if (link !== null && typeof link === 'object') {
      table.set(link.id, {
        originId: link.origin_id,
        originSlot: link.origin_slot,
        type: typeof link.type === 'string' ? link.type : null,
      });
    }
  }
  return table;
}

/**
 * Resolve one UI link through Reroutes, PrimitiveNodes, and bypassed nodes.
 * @param {Map<number, any>} nodeById nodes by id.
 * @param {Map<number, any>} linkById links by id.
 * @returns {(linkId: unknown, depth?: number) => ({ nodeId: number, slot: number } | { primitive: unknown } | null)} resolver.
 */
function createResolver(nodeById, linkById) {
  return function resolveLink(linkId, depth = 0) {
    if (depth > 32) return null;
    const link = linkById.get(linkId);
    if (link === undefined) return null;
    const source = nodeById.get(link.originId);
    if (source === undefined || source === null) return null;
    const type = String(source.type ?? '');
    if (type === 'Reroute') {
      const inner = (Array.isArray(source.inputs) ? source.inputs : []).find((input) => input !== null && typeof input === 'object' && input.link !== null && input.link !== undefined);
      return inner === undefined ? null : resolveLink(inner.link, depth + 1);
    }
    if (type === 'PrimitiveNode') {
      const value = Array.isArray(source.widgets_values) ? source.widgets_values[0] : undefined;
      return value === undefined ? null : { primitive: value };
    }
    if (source.mode === 4) {
      const outputs = Array.isArray(source.outputs) ? source.outputs : [];
      const output = outputs[link.originSlot];
      const wanted = typeof output?.type === 'string' ? output.type : link.type;
      const inputs = Array.isArray(source.inputs) ? source.inputs : [];
      const candidate = inputs.find((input) => input !== null && typeof input === 'object'
        && input.link !== null && input.link !== undefined
        && (wanted === null || wanted === undefined || input.type === wanted));
      return candidate === undefined ? null : resolveLink(candidate.link, depth + 1);
    }
    if (source.mode === 2) return null;
    return { nodeId: source.id, slot: link.originSlot };
  };
}

/**
 * Convert one frontend node into an API node.
 * @param {any} node frontend node.
 * @param {any} doc its `/object_info` document.
 * @param {ReturnType<typeof createResolver>} resolveLink link resolver.
 * @param {string[]} warnings collected warnings.
 * @returns {{ inputs: Record<string, unknown>, controls: Record<string, string> }} API inputs plus seed controls.
 */
function convertNode(node, doc, resolveLink, warnings) {
  const specs = widgetSpecs(doc);
  const specByName = new Map(specs.map((entry) => [entry.name, entry]));
  const inputs = {};
  const controls = {};
  const uiInputs = Array.isArray(node.inputs) ? node.inputs.filter((input) => input !== null && typeof input === 'object') : [];
  const linkedInputs = uiInputs.filter((input) => input.link !== null && input.link !== undefined);
  const linkedNames = new Set(linkedInputs.map((input) => String(input.name)));
  const widgetInputs = uiInputs.filter((input) => input.widget !== null && typeof input.widget === 'object' && (input.link === null || input.link === undefined));

  if (Array.isArray(node.widgets_values)) {
    const values = [...node.widgets_values];
    for (const input of widgetInputs) {
      const name = String(input.widget?.name ?? input.name);
      if (linkedNames.has(name) || values.length === 0) continue;
      const spec = specByName.get(name)?.spec;
      const value = values.shift();
      if (hasSeedControl(spec) && values.length > 0 && typeof values[0] === 'string' && CONTROL_VALUES.has(values[0])) {
        controls[name] = values.shift();
      }
      inputs[name] = value;
    }
    // Older workflows can omit widget entries from `inputs`; fill the rest in
    // object-info order so the values still land on the right names.
    for (const spec of specs) {
      if (values.length === 0) break;
      if (linkedNames.has(spec.name) || inputs[spec.name] !== undefined) continue;
      const value = values.shift();
      if (hasSeedControl(spec.spec) && values.length > 0 && typeof values[0] === 'string' && CONTROL_VALUES.has(values[0])) {
        controls[spec.name] = values.shift();
      }
      inputs[spec.name] = value;
    }
    if (values.length > 0) warnings.push(`节点 ${node.id}（${node.type}）有 ${values.length} 个多余控件值已忽略`);
  } else if (node.widgets_values !== null && typeof node.widgets_values === 'object') {
    for (const spec of specs) {
      if (linkedNames.has(spec.name)) continue;
      if (Object.prototype.hasOwnProperty.call(node.widgets_values, spec.name)) inputs[spec.name] = node.widgets_values[spec.name];
    }
  }

  for (const input of linkedInputs) {
    const name = String(input.name);
    const resolved = resolveLink(input.link);
    if (resolved === null) {
      warnings.push(`节点 ${node.id}（${node.type}）的输入 ${name} 找不到可用来源`);
      continue;
    }
    if (resolved.primitive !== undefined) {
      inputs[name] = resolved.primitive;
      continue;
    }
    inputs[name] = [String(resolved.nodeId), resolved.slot];
  }
  return { inputs, controls };
}

/**
 * Convert a frontend workflow into an API prompt plus the editable parameter
 * surface the studio panel exposes.
 *
 * @param {any} raw parsed workflow JSON.
 * @param {Map<string, any>} docs `/object_info` documents by node type.
 * @returns {{
 *   supported: boolean,
 *   reasons: string[],
 *   warnings: string[],
 *   outputKind: 'image' | 'video' | 'unknown',
 *   prompt: Record<string, { class_type: string, inputs: Record<string, unknown> }>,
 *   params: {
 *     positive: { nodeId: string, text: string } | null,
 *     negative: { nodeId: string, text: string } | null,
 *     sampler: { nodeId: string, seed: number, steps: number, cfg: number, sampler: string, scheduler: string, denoise: number, seedControl: string | null } | null,
 *     latent: { nodeId: string, width: number, height: number, batchSize: number } | null,
 *     checkpoint: string | null
 *   }
 * }}
 */
export function convertWorkflow(raw, docs) {
  const warnings = [];
  const reasons = [];
  const summary = summarizeWorkflow(raw);
  reasons.push(...summary.reasons);
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes.filter((node) => node !== null && typeof node === 'object') : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const linkById = linkTable(raw);
  const resolveLink = createResolver(nodeById, linkById);
  const prompt = {};
  const controlsByNode = new Map();
  const activeNodes = [];

  for (const node of nodes) {
    const type = String(node.type ?? '');
    if (UI_ONLY_TYPES.has(type) || isUuid(type)) continue;
    if (node.mode === 2 || node.mode === 4) continue;
    const doc = docs instanceof Map ? docs.get(type) : docs?.[type];
    if (doc === undefined || doc === null) {
      reasons.push(`不支持的节点类型：${type}`);
      continue;
    }
    activeNodes.push(node);
    const converted = convertNode(node, doc, resolveLink, warnings);
    prompt[String(node.id)] = { class_type: type, inputs: converted.inputs };
    controlsByNode.set(String(node.id), converted.controls);
  }

  // Required link inputs must all exist; ComfyUI would reject the prompt.
  for (const node of activeNodes) {
    const doc = docs instanceof Map ? docs.get(String(node.type)) : docs?.[String(node.type)];
    const required = doc?.input?.required;
    if (required === null || typeof required !== 'object') continue;
    const inputs = prompt[String(node.id)]?.inputs ?? {};
    for (const [name, spec] of Object.entries(required)) {
      if (isWidgetSpec(spec)) continue;
      if (inputs[name] === undefined) reasons.push(`节点 ${node.id}（${node.type}）缺少必需输入 ${name}`);
    }
  }

  const outputKind = summary.outputKind;
  const hasOutput = Object.keys(prompt).some((id) => {
    const type = prompt[id].class_type;
    const doc = docs instanceof Map ? docs.get(type) : docs?.[type];
    return doc?.output_node === true;
  });
  if (!hasOutput) reasons.push('工作流没有可提交的输出节点');
  if (outputKind === 'video') reasons.push('工作流输出视频，当前面板只支持图片');
  if (outputKind === 'unknown') reasons.push('无法识别工作流输出类型');

  const located = locatePrimary(prompt, nodes);
  const cleanup = applyPromptCleanup(prompt, docs, located, warnings);
  const missingAssets = checkMissingAssets(prompt, docs);
  for (const asset of missingAssets) {
    const folder = assetFolder(asset.classType);
    reasons.push(`缺少或无效的模型/文件：${asset.value}（${asset.classType}.${asset.input}）${folder === '' ? '' : `；请放到 ComfyUI/models/${folder}`}`);
  }

  const params = extractParams(prompt, nodes, controlsByNode, warnings);
  return {
    supported: reasons.length === 0 && summary.runnable,
    reasons: unique(reasons),
    warnings: unique(warnings),
    outputKind,
    prompt,
    params,
    cleanup,
    missingAssets,
  };
}

/**
 * @param {string[]} values values.
 * @returns {string[]} deduplicated values.
 */
function unique(values) {
  return [...new Set(values)];
}

/**
 * Extract the positive/negative prompts, sampler controls, latent size and
 * checkpoint name from a converted API graph.
 * @param {Record<string, any>} prompt API graph.
 * @param {any[]} nodes frontend nodes (for stable ordering).
 * @param {Map<string, Record<string, string>>} controlsByNode seed controls.
 * @param {string[]} warnings collected warnings.
 * @returns {any} parameter surface.
 */
function extractParams(prompt, nodes, controlsByNode, warnings) {
  const orderOf = new Map(nodes.map((node, index) => [String(node.id), typeof node.order === 'number' ? node.order : index]));
  const samplerIds = Object.keys(prompt)
    .filter((id) => prompt[id].class_type === 'KSampler' || prompt[id].class_type === 'KSamplerAdvanced')
    .sort((left, right) => (orderOf.get(left) ?? 0) - (orderOf.get(right) ?? 0));
  if (samplerIds.length === 0) {
    warnings.push('工作流里没有 KSampler，提示词与采样参数不可编辑');
    return { positive: null, negative: null, sampler: null, latent: null, checkpoint: checkpointOf(prompt) };
  }
  if (samplerIds.length > 1) warnings.push(`工作流包含 ${samplerIds.length} 个 KSampler，参数只应用到第一个`);
  const samplerId = samplerIds[0];
  const samplerNode = prompt[samplerId];
  const inputs = samplerNode.inputs;
  const isAdvanced = samplerNode.class_type === 'KSamplerAdvanced';
  const positiveId = edgeId(inputs.positive);
  const negativeId = edgeId(inputs.negative);
  const latentId = edgeId(inputs.latent_image);
  const positive = textParams(positiveId, prompt[positiveId]);
  const negative = textParams(negativeId, prompt[negativeId]);
  const latent = latentParams(latentId, prompt[latentId]);
  const sampler = {
    nodeId: samplerId,
    seed: numberOr(inputs[isAdvanced ? 'noise_seed' : 'seed'], 0),
    steps: numberOr(inputs.steps, OFFICIAL_DEFAULTS.steps),
    cfg: numberOr(inputs.cfg, OFFICIAL_DEFAULTS.cfg),
    sampler: typeof inputs.sampler_name === 'string' ? inputs.sampler_name : OFFICIAL_DEFAULTS.sampler,
    scheduler: typeof inputs.scheduler === 'string' ? inputs.scheduler : OFFICIAL_DEFAULTS.scheduler,
    denoise: numberOr(inputs.denoise, 1),
    seedControl: controlsByNode.get(samplerId)?.[isAdvanced ? 'noise_seed' : 'seed'] ?? null,
  };
  if (isAdvanced) warnings.push('工作流使用 KSamplerAdvanced，面板只调整种子/步数/CFG/采样器');
  return { positive, negative, sampler, latent, checkpoint: checkpointOf(prompt) };
}

/**
 * @param {unknown} edge API input edge value.
 * @returns {string | null} source node id.
 */
function edgeId(edge) {
  return Array.isArray(edge) && edge.length >= 1 ? String(edge[0]) : null;
}

/**
 * @param {string | null} nodeId source node id.
 * @param {any} node source node.
 * @returns {{ nodeId: string, text: string } | null} editable text reference.
 */
function textParams(nodeId, node) {
  if (nodeId === null || node === undefined || node === null) return null;
  if (node.class_type !== 'CLIPTextEncode') return null;
  if (typeof node.inputs?.text !== 'string') return null;
  return { nodeId, text: node.inputs.text };
}

/**
 * @param {string | null} nodeId source node id.
 * @param {any} node source node.
 * @returns {{ nodeId: string, width: number, height: number, batchSize: number } | null} latent reference.
 */
function latentParams(nodeId, node) {
  if (nodeId === null || node === undefined || node === null || node.class_type !== 'EmptyLatentImage') return null;
  return {
    nodeId,
    width: numberOr(node.inputs.width, OFFICIAL_DEFAULTS.width),
    height: numberOr(node.inputs.height, OFFICIAL_DEFAULTS.height),
    batchSize: numberOr(node.inputs.batch_size, 1),
  };
}

/**
 * @param {unknown} value raw.
 * @param {number} fallback default.
 * @returns {number} finite number.
 */
function numberOr(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Find the checkpoint/unet name shown next to the workflow.
 * @param {Record<string, any>} prompt API graph.
 * @returns {string | null} model name.
 */
function checkpointOf(prompt) {
  for (const node of Object.values(prompt)) {
    if (node.class_type === 'CheckpointLoaderSimple' && typeof node.inputs?.ckpt_name === 'string') return node.inputs.ckpt_name;
    if (node.class_type === 'UNETLoader' && typeof node.inputs?.unet_name === 'string') return node.inputs.unet_name;
  }
  return null;
}

/**
 * Apply the panel's edits to a converted workflow.
 * @param {{ prompt: Record<string, any>, params: any }} converted conversion result.
 * @param {Record<string, unknown>} overrides edits from the panel.
 * @returns {{ prompt: Record<string, any>, applied: string[] }} API graph with edits.
 */
export function applyOverrides(converted, overrides) {
  const prompt = JSON.parse(JSON.stringify(converted.prompt));
  const params = converted.params ?? {};
  const applied = [];
  const raw = overrides !== null && typeof overrides === 'object' ? overrides : {};

  if (params.positive !== null && typeof raw.positive === 'string') {
    const node = prompt[params.positive.nodeId];
    if (node !== undefined) {
      node.inputs.text = raw.positive;
      applied.push('positive');
    }
  }
  if (params.negative !== null && typeof raw.negative === 'string') {
    const node = prompt[params.negative.nodeId];
    if (node !== undefined) {
      node.inputs.text = raw.negative;
      applied.push('negative');
    }
  }
  if (params.sampler !== null) {
    const node = prompt[params.sampler.nodeId];
    if (node !== undefined) {
      const advanced = node.class_type === 'KSamplerAdvanced';
      if (raw.seed !== undefined) {
        const seed = integerInRange(raw.seed, 0, Number.MAX_SAFE_INTEGER);
        node.inputs[advanced ? 'noise_seed' : 'seed'] = seed;
        applied.push('seed');
      }
      if (raw.steps !== undefined) {
        node.inputs.steps = integerInRange(raw.steps, 1, 500);
        applied.push('steps');
      }
      if (raw.cfg !== undefined) {
        node.inputs.cfg = numberInRange(raw.cfg, 0, 100);
        applied.push('cfg');
      }
      if (typeof raw.sampler === 'string' && raw.sampler !== '') {
        node.inputs.sampler_name = raw.sampler.slice(0, 120);
        applied.push('sampler');
      }
      if (typeof raw.scheduler === 'string' && raw.scheduler !== '') {
        node.inputs.scheduler = raw.scheduler.slice(0, 120);
        applied.push('scheduler');
      }
    }
  }
  if (params.latent !== null && params.latent !== undefined) {
    const node = prompt[params.latent.nodeId];
    if (node !== undefined) {
      if (raw.width !== undefined) {
        node.inputs.width = dimensionInRange(raw.width, 'width', 64, 4096);
        applied.push('width');
      }
      if (raw.height !== undefined) {
        node.inputs.height = dimensionInRange(raw.height, 'height', 64, 4096);
        applied.push('height');
      }
      if (raw.batchSize !== undefined) {
        node.inputs.batch_size = integerInRange(raw.batchSize, 1, 16);
        applied.push('batchSize');
      }
    }
  }
  if (Array.isArray(raw.loras)) {
    const bypassed = new Set();
    for (const entry of raw.loras) {
      if (entry === null || typeof entry !== 'object') continue;
      const nodeId = String(entry.nodeId ?? '');
      const node = prompt[nodeId];
      if (node === undefined || (node.class_type !== 'LoraLoader' && node.class_type !== 'LoraLoaderModelOnly')) continue;
      if (typeof entry.name === 'string' && entry.name !== '') node.inputs.lora_name = entry.name.slice(0, 512);
      if (entry.model !== undefined && entry.model !== null) node.inputs.strength_model = numberInRange(entry.model, -20, 20);
      if (node.class_type === 'LoraLoader' && entry.clip !== undefined && entry.clip !== null) node.inputs.strength_clip = numberInRange(entry.clip, -20, 20);
      applied.push(`lora:${nodeId}`);
      if (entry.enabled === false) bypassed.add(nodeId);
    }
    // Bypassing a LoRA node means its MODEL/CLIP outputs pass its own inputs
    // straight through, exactly like the ComfyUI canvas bypass mode.
    let guard = bypassed.size + 2;
    while (bypassed.size > 0 && guard-- > 0) {
      const nodeId = bypassed.values().next().value;
      bypassed.delete(nodeId);
      const node = prompt[nodeId];
      if (node === undefined) continue;
      const passThrough = { 0: node.inputs.model, 1: node.inputs.clip };
      for (const consumer of Object.values(prompt)) {
        if (consumer === node) continue;
        for (const [name, value] of Object.entries(consumer.inputs ?? {})) {
          if (!Array.isArray(value) || String(value[0]) !== nodeId) continue;
          const replacement = passThrough[Number(value[1])];
          if (replacement !== undefined) consumer.inputs[name] = Array.isArray(replacement) ? [String(replacement[0]), Number(replacement[1])] : replacement;
        }
      }
      delete prompt[nodeId];
      applied.push('loraBypass');
    }
  }
  return { prompt, applied };
}

/**
 * @param {unknown} value raw.
 * @param {number} min minimum.
 * @param {number} max maximum.
 * @returns {number} integer in range.
 */
function integerInRange(value, min, max) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`值必须是 ${min} 到 ${max} 之间的整数`);
  }
  return number;
}

/**
 * @param {unknown} value raw.
 * @param {number} min minimum.
 * @param {number} max maximum.
 * @returns {number} number in range.
 */
function numberInRange(value, min, max) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`值必须是 ${min} 到 ${max} 之间的数字`);
  return number;
}

/**
 * @param {unknown} value raw.
 * @param {string} name field name.
 * @param {number} min minimum.
 * @param {number} max maximum.
 * @returns {number} multiple of 8 in range.
 */
function dimensionInRange(value, name, min, max) {
  const number = integerInRange(value, min, max);
  if (number % 8 !== 0) throw new Error(`${name} 必须是 8 的倍数`);
  return number;
}


/**
 * Find the primary sampler and the nodes its prompt/latent edges point at.
 * @param {Record<string, any>} prompt API graph.
 * @param {any[]} nodes frontend nodes (stable ordering).
 * @returns {{ samplerId: string | null, positiveId: string | null, negativeId: string | null, latentId: string | null }}
 */
function locatePrimary(prompt, nodes) {
  const orderOf = new Map(nodes.map((node, index) => [String(node.id), typeof node.order === 'number' ? node.order : index]));
  const samplerIds = Object.keys(prompt)
    .filter((id) => prompt[id].class_type === 'KSampler' || prompt[id].class_type === 'KSamplerAdvanced')
    .sort((left, right) => (orderOf.get(left) ?? 0) - (orderOf.get(right) ?? 0));
  if (samplerIds.length === 0) return { samplerId: null, positiveId: null, negativeId: null, latentId: null };
  const samplerId = samplerIds[0];
  const inputs = prompt[samplerId].inputs;
  return {
    samplerId,
    positiveId: edgeId(inputs.positive),
    negativeId: edgeId(inputs.negative),
    latentId: edgeId(inputs.latent_image),
  };
}

/** A1111 sampler names → ComfyUI sampler names. */
const A1111_SAMPLER_MAP = Object.freeze({
  euler_a: 'euler_ancestral',
  euler: 'euler',
  dpmpp_2m: 'dpmpp_2m',
  dpmpp_2m_sde: 'dpmpp_2m_sde',
  dpmpp_3m_sde: 'dpmpp_3m_sde',
  dpmpp_sde: 'dpmpp_sde',
  dpm_2: 'dpm_2',
  dpm_2_ancestral: 'dpm_2_ancestral',
  dpm_fast: 'dpm_fast',
  dpm_adaptive: 'dpm_adaptive',
  ddim: 'ddim',
  unipc: 'uni_pc',
  heun: 'heun',
  lms: 'lms',
  deis: 'deis',
  ipndm: 'ipndm',
  lcm: 'lcm',
});

/**
 * Map an A1111 sampler/schedule pair onto ComfyUI names.
 * @param {string | null} sampler A1111 sampler text.
 * @param {string | null} schedule A1111 schedule text.
 * @returns {{ sampler: string | null, scheduler: string | null }} mapped names.
 */
function mapA1111Sampler(sampler, schedule) {
  let name = String(sampler ?? '').trim().toLowerCase();
  let scheduler = null;
  if (name.includes('karras')) {
    scheduler = 'karras';
    name = name.replace(/karras/g, ' ');
  }
  name = name.replace(/\+/g, 'p').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const mapped = A1111_SAMPLER_MAP[name] ?? null;
  const scheduleText = String(schedule ?? '').trim().toLowerCase();
  if (scheduleText !== '') {
    if (scheduleText.includes('karras')) scheduler = 'karras';
    else if (scheduleText.includes('exponential')) scheduler = 'exponential';
    else if (scheduleText.includes('sgm')) scheduler = 'sgm_uniform';
    else if (scheduleText.includes('ddim')) scheduler = 'ddim_uniform';
    else if (scheduleText.includes('beta')) scheduler = 'beta';
    else if (scheduleText.includes('linear')) scheduler = 'linear_quadratic';
    else if (scheduleText.includes('kl')) scheduler = 'kl_optimal';
    else if (scheduleText.includes('simple')) scheduler = 'simple';
    else if (scheduleText.includes('normal')) scheduler = 'normal';
    else scheduler = null;
  }
  return { sampler: mapped, scheduler };
}

/**
 * @param {unknown} value raw number text.
 * @returns {number | null} integer or null.
 */
function toInt(value) {
  const number = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(number) ? number : null;
}

/**
 * @param {unknown} value raw number text.
 * @returns {number | null} finite number or null.
 */
function toNumber(value) {
  const number = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(number) ? number : null;
}

/**
 * Parse the A1111 parameter suffix (`Steps: 30, CFG scale: 3, ...`).
 * @param {string} segment metadata segment.
 * @returns {{ steps: number | null, cfg: number | null, sampler: string | null, samplerRaw: string | null, scheduler: string | null, schedulerRaw: string | null, seed: number | null, width: number | null, height: number | null }}
 */
function parseA1111Params(segment) {
  const pick = (regex) => {
    const match = regex.exec(segment);
    return match === null ? null : match[1];
  };
  const samplerRaw = pick(/Sampler:\s*([^,]+)/);
  const scheduleRaw = pick(/Schedule type:\s*([^,]+)/);
  const mapped = mapA1111Sampler(samplerRaw, scheduleRaw);
  return {
    steps: toInt(pick(/Steps:\s*(\d+)/)),
    cfg: toNumber(pick(/CFG scale:\s*([\d.]+)/)),
    sampler: mapped.sampler,
    samplerRaw,
    scheduler: mapped.scheduler,
    schedulerRaw: scheduleRaw,
    seed: toInt(pick(/Seed:\s*(\d+)/)),
    width: toInt(pick(/\bwidth:\s*(\d+)/)),
    height: toInt(pick(/\bheight:\s*(\d+)/)),
    clipSkip: toInt(pick(/Clip skip:\s*(\d+)/)),
  };
}

/**
 * Strip `<lora:name:weight>` tags (ComfyUI's backend never loads LoRAs from
 * prompt text; the frontend's A1111 importer converts them into LoraLoader
 * nodes, but saved hand-built workflows keep them as literal text).
 * @param {string} text prompt text.
 * @returns {{ text: string, loras: Array<{ name: string, weight: number }> }} cleaned text and tags.
 */
function stripLoraTags(text) {
  const loras = [];
  const cleaned = String(text ?? '').replace(/<lora:([^:>]+):([^>]+)>/gi, (match, name, weight) => {
    const value = Number.parseFloat(weight);
    loras.push({ name: String(name).trim(), weight: Number.isFinite(value) ? value : 1 });
    return '';
  });
  return { text: cleaned, loras };
}

/**
 * @param {string} text prompt fragment.
 * @returns {string} tidied prompt fragment.
 */
function tidyPrompt(text) {
  return String(text ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\s,]+/, '')
    .replace(/[\s,]+$/, '')
    .trim();
}

/**
 * Detect and clean a prompt that carries an A1111 parameter dump (and LoRA
 * tags), returning the clean prompt plus the reference parameters.
 * @param {string} input raw prompt text.
 * @returns {{ cleaned: boolean, positive: string, embeddedNegative: string, params: ReturnType<typeof parseA1111Params> | null, loras: Array<{ name: string, weight: number }> }}
 */
export function cleanA1111Prompt(input) {
  const text = String(input ?? '');
  const negativeIndex = text.indexOf('Negative prompt:');
  const stepsMatch = /\bSteps:\s*\d+/.exec(text);
  const stepsIndex = stepsMatch === null ? -1 : stepsMatch.index;
  const hasMetadata = stepsIndex >= 0 || negativeIndex >= 0;
  if (!hasMetadata) {
    const whole = stripLoraTags(text);
    return {
      cleaned: whole.loras.length > 0,
      positive: tidyPrompt(whole.text),
      embeddedNegative: '',
      params: null,
      loras: whole.loras,
    };
  }
  const cut = [negativeIndex, stepsIndex].filter((index) => index >= 0).sort((left, right) => left - right)[0] ?? text.length;
  const positiveSource = text.slice(0, cut);
  const negativeSource = negativeIndex >= 0 && (stepsIndex < 0 || negativeIndex < stepsIndex)
    ? text.slice(negativeIndex + 'Negative prompt:'.length, stepsIndex >= 0 ? stepsIndex : text.length)
    : '';
  const params = stepsIndex >= 0 ? parseA1111Params(text.slice(stepsIndex)) : null;
  const positive = stripLoraTags(positiveSource);
  const negative = stripLoraTags(negativeSource);
  return {
    cleaned: true,
    positive: tidyPrompt(positive.text),
    embeddedNegative: tidyPrompt(negative.text),
    params,
    loras: positive.loras.concat(negative.loras),
  };
}

/**
 * Clean the primary prompt pair and apply the reference parameters back to the
 * API graph so the panel's defaults match the original reference run.
 * @param {Record<string, any>} prompt API graph (mutated).
 * @param {Map<string, any>} docs object-info documents.
 * @param {ReturnType<typeof locatePrimary>} located primary node ids.
 * @param {string[]} warnings collected warnings.
 * @returns {any | null} cleanup summary.
 */
function applyPromptCleanup(prompt, docs, located, warnings) {
  if (located.samplerId === null) return null;
  const sampler = prompt[located.samplerId];
  const positiveNode = located.positiveId === null ? null : prompt[located.positiveId];
  if (positiveNode === undefined || positiveNode === null || positiveNode.class_type !== 'CLIPTextEncode' || typeof positiveNode.inputs.text !== 'string') return null;
  const cleaned = cleanA1111Prompt(positiveNode.inputs.text);
  if (!cleaned.cleaned) return null;
  positiveNode.inputs.text = cleaned.positive;

  const loras = [...cleaned.loras];
  const negativeNode = located.negativeId === null ? null : prompt[located.negativeId];
  if (negativeNode !== undefined && negativeNode !== null && negativeNode.class_type === 'CLIPTextEncode' && typeof negativeNode.inputs.text === 'string') {
    const stripped = stripLoraTags(negativeNode.inputs.text);
    negativeNode.inputs.text = stripped.text;
    loras.push(...stripped.loras);
    if (negativeNode.inputs.text.trim() === '' && cleaned.embeddedNegative !== '') negativeNode.inputs.text = cleaned.embeddedNegative;
  }

  const applied = [];
  const reference = cleaned.params;
  if (reference !== null) {
    const doc = docs.get(sampler.class_type);
    const samplerOptions = doc?.input?.required?.sampler_name?.[0];
    const schedulerOptions = doc?.input?.required?.scheduler?.[0];
    const advanced = sampler.class_type === 'KSamplerAdvanced';
    if (Number.isSafeInteger(reference.steps) && reference.steps >= 1 && reference.steps <= 500) {
      sampler.inputs.steps = reference.steps;
      applied.push(`步数 ${reference.steps}`);
    }
    if (Number.isFinite(reference.cfg) && reference.cfg >= 0 && reference.cfg <= 100) {
      sampler.inputs.cfg = reference.cfg;
      applied.push(`CFG ${reference.cfg}`);
    }
    if (typeof reference.sampler === 'string' && reference.sampler !== '' && (!Array.isArray(samplerOptions) || samplerOptions.includes(reference.sampler))) {
      sampler.inputs.sampler_name = reference.sampler;
      applied.push(`采样器 ${reference.sampler}`);
    } else if (reference.samplerRaw !== null && reference.samplerRaw !== '') {
      warnings.push(`A1111 采样器「${reference.samplerRaw}」无法映射到服务端，保留工作流的值`);
    }
    if (typeof reference.scheduler === 'string' && (!Array.isArray(schedulerOptions) || schedulerOptions.includes(reference.scheduler))) {
      sampler.inputs.scheduler = reference.scheduler;
      applied.push(`调度器 ${reference.scheduler}`);
    }
    if (Number.isSafeInteger(reference.seed) && reference.seed >= 0 && reference.seed <= Number.MAX_SAFE_INTEGER) {
      sampler.inputs[advanced ? 'noise_seed' : 'seed'] = reference.seed;
      applied.push(`种子 ${reference.seed}`);
    }
    // A1111 metadata stores the final (hires-fixed) size, not the base latent
    // the model was sampled at, so keep the workflow's latent size and only
    // explain the difference.
    const latentNode = located.latentId === null ? null : prompt[located.latentId];
    if (latentNode !== undefined && latentNode !== null && latentNode.class_type === 'EmptyLatentImage'
      && Number.isSafeInteger(reference.width) && Number.isSafeInteger(reference.height)
      && latentNode.inputs !== undefined
      && (latentNode.inputs.width !== reference.width || latentNode.inputs.height !== reference.height)) {
      warnings.push(`A1111 元数据尺寸 ${reference.width}×${reference.height} 疑似放大后的尺寸，已保留工作流潜空间 ${latentNode.inputs.width}×${latentNode.inputs.height}`);
    }
    if (Number.isSafeInteger(reference.clipSkip) && reference.clipSkip > 1) {
      warnings.push(`A1111 元数据包含 Clip skip: ${reference.clipSkip}，当前工作流没有 CLIPSetLastLayer 节点，出图会与原参考不同`);
    }
  }
  warnings.push(applied.length > 0
    ? `提示词里包含 A1111 参数，已清理并恢复参考参数：${applied.join(' / ')}`
    : '提示词里包含 A1111 参数，已清理其中的元数据');
  if (loras.length > 0) {
    warnings.push(`已移除 ${loras.length} 个 <lora:...> 标签（ComfyUI 不会从文本加载 LoRA）：${loras.map((lora) => lora.name).join(', ')}`);
  }
  return { applied: true, source: 'a1111', loras, params: reference, appliedParams: applied, embeddedNegative: cleaned.embeddedNegative };
}

/**
 * Validate every combo input against the server's advertised options; a
 * mismatch is usually a missing model file and makes `/prompt` reject the job.
 * @param {Record<string, any>} prompt API graph.
 * @param {Map<string, any>} docs object-info documents.
 * @returns {Array<{ nodeId: string, classType: string, input: string, value: string }>} missing assets.
 */
function checkMissingAssets(prompt, docs) {
  const missing = [];
  for (const [nodeId, node] of Object.entries(prompt)) {
    const doc = docs instanceof Map ? docs.get(node.class_type) : null;
    if (doc === undefined || doc === null) continue;
    for (const section of ['required', 'optional']) {
      const inputs = doc.input?.[section];
      if (inputs === null || typeof inputs !== 'object') continue;
      for (const [name, spec] of Object.entries(inputs)) {
        if (!Array.isArray(spec) || !Array.isArray(spec[0])) continue;
        const value = node.inputs[name];
        if (typeof value !== 'string' || value === '') continue;
        if (!spec[0].includes(value)) missing.push({ nodeId, classType: node.class_type, input: name, value });
      }
    }
  }
  return missing;
}


/**
 * Classify a checkpoint/unet name into the prompt style its model expects.
 * Tag models (Illustrious/NoobAI/Anima/Pony…) need danbooru tags; natural
 * models (Flux/SD3/Qwen-Image…) need prose; unknown routes get both.
 * @param {unknown} model checkpoint or unet name.
 * @returns {'tags' | 'natural' | 'both'} prompt style.
 */
export function classifyModel(model) {
  const name = String(model ?? '').toLowerCase();
  if (/noob|illustrious|animagine|anima|pony|meina|anything|counterfeit|abyss|dreamshaper|juggernaut|sdxl|sd15|sd1[._]5/.test(name)) return 'tags';
  if (/flux|stable[-_ ]?diffusion[-_ ]?3|sd3|qwen|kolors|hunyuan|lumina|chroma|hidream|cosmos/.test(name)) return 'natural';
  return 'both';
}


/**
 * The ComfyUI models subfolder a loader reads from.
 * @param {string} classType loader class type.
 * @returns {string} folder or an empty string.
 */
function assetFolder(classType) {
  switch (classType) {
    case 'CheckpointLoaderSimple':
      return 'checkpoints';
    case 'UNETLoader':
    case 'UnetLoaderGGUF':
      return 'diffusion_models';
    case 'CLIPLoader':
      return 'text_encoders';
    case 'VAELoader':
      return 'vae';
    case 'LoraLoader':
    case 'LoraLoaderModelOnly':
      return 'loras';
    case 'UpscaleModelLoader':
      return 'upscale_models';
    case 'ControlNetLoader':
      return 'controlnet';
    default:
      return '';
  }
}
