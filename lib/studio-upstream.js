/**
 * Extra ComfyUI upstream calls used by the studio panel: the user's saved
 * workflows (list, fetch, save, delete), per-node `/object_info` documents
 * needed to convert a UI workflow into an API prompt, the compact node catalog
 * for the canvas palette, and direct API-graph submission.
 */
import { getJson, postJson, ComfyUpstreamError } from './comfy.js';

const OBJECT_INFO_TTL_MS = 5 * 60 * 1000;
const NODE_CATALOG_TTL_MS = 5 * 60 * 1000;
const NODE_CATALOG_TIMEOUT_MS = 30000;
const USERDATA_TIMEOUT_MS = 20000;
const MAX_WORKFLOW_BYTES = 8 * 1024 * 1024;
const MAX_NAME = 300;

/** @type {Map<string, { at: number, doc: any }>} */
const objectInfoCache = new Map();
/** @type {Map<string, { at: number, catalog: Array<{ type: string, display: string, category: string, outputNode: boolean }> }>} */
const nodeCatalogCache = new Map();

/** Drop the object_info cache (tests). */
export function clearObjectInfoCache() {
  objectInfoCache.clear();
}

/** Drop the compact node catalog cache (tests). */
export function clearNodeCatalogCache() {
  nodeCatalogCache.clear();
}

/**
 * List the ComfyUI userdata workflows (`workflows/` folder), recursing into
 * subfolders. Names are relative to that folder and end in `.json`.
 * @param {string} base normalised ComfyUI base URL.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<string[]>} workflow names.
 */
export async function listUserWorkflows(base, options = {}) {
  const list = await getJson(base, '/userdata?dir=workflows&recurse=true', {
    timeoutMs: options.timeoutMs ?? 15000,
    signal: options.signal,
  });
  if (!Array.isArray(list)) return [];
  return list
    .filter((name) => typeof name === 'string' && name !== '' && !name.includes('..') && !name.includes('\\'))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
}

/**
 * Fetch one saved workflow document by its userdata name.
 * @param {string} base normalised ComfyUI base URL.
 * @param {string} name workflow name from {@link listUserWorkflows}.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<any>} parsed workflow JSON.
 */
export async function fetchUserWorkflow(base, name, options = {}) {
  validateWorkflowName(name);
  const encoded = encodeURIComponent(`workflows/${name}`);
  return getJson(base, `/userdata/${encoded}`, {
    timeoutMs: options.timeoutMs ?? 15000,
    maxBytes: MAX_WORKFLOW_BYTES,
    signal: options.signal,
  });
}

/**
 * @param {unknown} name workflow name.
 * @returns {void}
 */
function validateWorkflowName(name) {
  if (typeof name !== 'string' || name.trim() === '' || name.length > MAX_NAME) {
    throw new Error('workflow name is invalid');
  }
  if (name.includes('..') || name.includes('\\') || name.startsWith('/')) {
    throw new Error('workflow name is invalid');
  }
}

/**
 * Read one node's `/object_info` document, cached per server and type.
 * Returns null when the server does not expose that node type (frontend-only
 * nodes such as Notes and Reroutes are expected to produce null).
 * @param {string} base normalised ComfyUI base URL.
 * @param {string} type node class type.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<any | null>} the node document or null.
 */
export async function fetchObjectInfo(base, type, options = {}) {
  if (typeof type !== 'string' || type === '' || type.length > 200) return null;
  const key = `${base}\u0000${type}`;
  const cached = objectInfoCache.get(key);
  if (cached !== undefined && Date.now() - cached.at < OBJECT_INFO_TTL_MS) return cached.doc;
  let doc = null;
  try {
    const raw = await getJson(base, `/object_info/${encodeURIComponent(type)}`, {
      timeoutMs: options.timeoutMs ?? 10000,
      signal: options.signal,
    });
    if (raw !== null && typeof raw === 'object' && raw[type] !== undefined) doc = raw[type];
  } catch (error) {
    if (!(error instanceof ComfyUpstreamError) || error.status !== 404) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/HTTP 404/.test(message)) throw error;
    }
    doc = null;
  }
  objectInfoCache.set(key, { at: Date.now(), doc });
  return doc;
}

/**
 * Fetch the whole `/object_info` catalog and reduce it to the compact node
 * palette entries the studio canvas needs (never the multi-megabyte documents).
 * Cached per server for five minutes.
 * @param {string} base normalised ComfyUI base URL.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<Array<{ type: string, display: string, category: string, outputNode: boolean }>>} compact catalog.
 */
export async function fetchNodeCatalog(base, options = {}) {
  const cached = nodeCatalogCache.get(base);
  if (cached !== undefined && Date.now() - cached.at < NODE_CATALOG_TTL_MS) return cached.catalog;
  const raw = await getJson(base, '/object_info', {
    timeoutMs: Math.max(options.timeoutMs ?? 0, NODE_CATALOG_TIMEOUT_MS),
    signal: options.signal,
  });
  const catalog = compactNodeCatalog(raw);
  nodeCatalogCache.set(base, { at: Date.now(), catalog });
  return catalog;
}

/**
 * @param {unknown} raw `/object_info` response.
 * @returns {Array<{ type: string, display: string, category: string, outputNode: boolean }>} compact entries sorted by category then display.
 */
function compactNodeCatalog(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const nodes = [];
  for (const [type, doc] of Object.entries(/** @type {Record<string, any>} */ (raw))) {
    if (typeof type !== 'string' || type === '' || doc === null || typeof doc !== 'object') continue;
    const display = typeof doc.display_name === 'string' && doc.display_name.trim() !== '' ? doc.display_name : type;
    const category = typeof doc.category === 'string' && doc.category.trim() !== '' ? doc.category : '其它';
    nodes.push({ type, display, category, outputNode: doc.output_node === true });
  }
  nodes.sort((left, right) => left.category.localeCompare(right.category, 'en', { numeric: true })
    || left.display.localeCompare(right.display, 'en', { numeric: true })
    || left.type.localeCompare(right.type, 'en', { numeric: true }));
  return nodes;
}

/**
 * Validate and normalise a workflow file name used by the studio editor.
 * @param {unknown} name raw name from the request.
 * @returns {string} trimmed workflow name.
 */
export function normalizeWorkflowFileName(name) {
  if (typeof name !== 'string') throw new Error('workflow name is invalid');
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > MAX_NAME) throw new Error('workflow name is invalid');
  if (!trimmed.endsWith('.json')) throw new Error('workflow name must end with .json');
  if (trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('\\')) throw new Error('workflow name is invalid');
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error('workflow name is invalid');
  return trimmed;
}

/**
 * Save (or overwrite) one workflow in ComfyUI's userdata `workflows/` folder.
 * @param {string} base normalised ComfyUI base URL.
 * @param {string} name workflow file name (must end in `.json`).
 * @param {unknown} graph frontend workflow JSON.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<string>} the validated workflow name.
 */
export async function saveUserWorkflow(base, name, graph, options = {}) {
  const safeName = normalizeWorkflowFileName(name);
  await requestUserdata(base, 'POST', safeName, graph, options);
  return safeName;
}

/**
 * Delete one workflow from ComfyUI's userdata `workflows/` folder.
 * @param {string} base normalised ComfyUI base URL.
 * @param {string} name workflow file name (must end in `.json`).
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<string>} the validated workflow name.
 */
export async function deleteUserWorkflow(base, name, options = {}) {
  const safeName = normalizeWorkflowFileName(name);
  await requestUserdata(base, 'DELETE', safeName, undefined, options);
  return safeName;
}

/**
 * JSON request against one userdata workflow path. Unlike a plain `getJson`
 * this requires a 2xx status even when the upstream answers with an empty body
 * (ComfyUI save returns the stored path, delete returns 204).
 * @param {string} base normalised ComfyUI base URL.
 * @param {'POST' | 'DELETE'} method HTTP method.
 * @param {string} name validated workflow name.
 * @param {unknown} [body] JSON body for POST.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<unknown>} parsed JSON response (`{}` when empty).
 */
async function requestUserdata(base, method, name, body, options = {}) {
  const url = `${base}/userdata/${encodeURIComponent(`workflows/${name}`)}`;
  const timeoutMs = Math.max(options.timeoutMs ?? 0, USERDATA_TIMEOUT_MS);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const external = options.signal;
  const onAbort = () => controller.abort();
  if (external !== undefined) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onAbort, { once: true });
  }
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined
        ? { accept: 'application/json' }
        : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'error',
    });
  } catch (error) {
    throw describeUserdataError(error, url, timeoutMs, timedOut);
  } finally {
    clearTimeout(timer);
    if (external !== undefined) external.removeEventListener('abort', onAbort);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = buffer.toString('utf8').trim();
  let parsed = {};
  if (text !== '') {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ComfyUpstreamError(`ComfyUI returned a non-JSON response (HTTP ${response.status})`, { status: response.status });
    }
  }
  if (!response.ok) throw upstreamErrorOfBody(parsed, response.status);
  return parsed;
}

/**
 * Turn a fetch rejection into an actionable message.
 * @param {unknown} error thrown value.
 * @param {string} url requested URL.
 * @param {number} timeoutMs timeout used.
 * @param {boolean} timedOut whether our timer fired.
 * @returns {Error} readable error.
 */
function describeUserdataError(error, url, timeoutMs, timedOut) {
  if (timedOut) return new Error(`ComfyUI request timed out after ${timeoutMs} ms (${url})`);
  const cause = /** @type {any} */ (error)?.cause;
  const code = cause?.code ?? /** @type {any} */ (error)?.code;
  if (code === 'ECONNREFUSED') return new Error(`ComfyUI refused the connection (${url}). Is ComfyUI running and listening on that port?`);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new Error(`ComfyUI host not found (${url}). Check the address.`);
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return new Error(`ComfyUI host is unreachable (${url}). Are both devices on the same network?`);
  if (code === 'ECONNRESET') return new Error(`ComfyUI closed the connection (${url}).`);
  return new Error(`cannot reach ComfyUI at ${url}: ${cause?.message ?? /** @type {any} */ (error)?.message ?? String(error)}`);
}

/**
 * Build an error from a ComfyUI error body.
 * @param {unknown} body parsed JSON body.
 * @param {number} status HTTP status.
 * @returns {ComfyUpstreamError} error with the upstream body attached.
 */
function upstreamErrorOfBody(body, status) {
  const record = body !== null && typeof body === 'object' ? /** @type {any} */ (body) : {};
  const raw = record.error;
  const message = raw !== null && typeof raw === 'object' ? raw.message ?? raw.type : typeof raw === 'string' ? raw : '';
  return new ComfyUpstreamError(String(message !== '' ? message : `ComfyUI returned HTTP ${status}`), { status, body });
}

/**
 * Submit one API-format prompt graph to ComfyUI.
 * @param {string} base normalised ComfyUI base URL.
 * @param {Record<string, { class_type: string, inputs: Record<string, unknown> }>} graph API prompt.
 * @param {{ timeoutMs?: number, signal?: AbortSignal, clientId?: string }} [options]
 * @returns {Promise<{ promptId: string, number: number | null, nodeErrors: Record<string, unknown> | null }>}
 */
export async function submitGraph(base, graph, options = {}) {
  let response;
  try {
    response = await postJson(base, '/prompt', {
      prompt: graph,
      client_id: options.clientId ?? `dsh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    }, {
      timeoutMs: options.timeoutMs ?? 20000,
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
