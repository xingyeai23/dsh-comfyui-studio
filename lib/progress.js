/**
 * ComfyUI live progress tracking over its WebSocket.
 *
 * ComfyUI broadcasts execution events only to the WebSocket client whose
 * `clientId` matches the submitted prompt, so this tracker owns one stable
 * client id per server origin, keeps one socket open, and exposes the latest
 * execution state for the panel's `/live` route. It also accepts
 * `crystools.monitor` messages when that extension is installed, so a future
 * GPU-utilization display can use them without changing the transport.
 */

const MAX_ENTRIES = 4;
const RECONNECT_MS = 2000;

/**
 * Apply one ComfyUI WebSocket message to the progress state.
 * @param {any | null} previous prior state.
 * @param {any} message parsed WebSocket message.
 * @returns {any | null} next state (same reference when the message is ignored).
 */
export function reduceProgress(previous, message) {
  const type = message !== null && typeof message === 'object' ? message.type : undefined;
  const data = message !== null && typeof message === 'object' && message.data !== null && typeof message.data === 'object'
    ? message.data
    : {};
  const now = Date.now();
  const done = Array.isArray(previous?.doneNodes) ? previous.doneNodes : [];
  const addDone = (ids) => {
    const set = new Set(done);
    for (const id of ids) {
      if (typeof id === 'string' || typeof id === 'number') set.add(String(id));
    }
    return [...set];
  };
  const gpuUtilization = previous?.gpuUtilization ?? null;
  switch (type) {
    case 'execution_start':
      return {
        promptId: typeof data.prompt_id === 'string' ? data.prompt_id : null,
        status: 'running',
        node: null,
        value: 0,
        max: 0,
        percent: 0,
        error: null,
        doneNodes: [],
        gpuUtilization,
        updatedAt: now,
      };
    case 'progress': {
      const value = Number(data.value);
      const max = Number(data.max);
      const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
      const safeMax = Number.isFinite(max) ? Math.max(0, max) : 0;
      return {
        promptId: typeof data.prompt_id === 'string' ? data.prompt_id : previous?.promptId ?? null,
        status: 'running',
        node: typeof data.node === 'string' ? data.node : previous?.node ?? null,
        value: safeValue,
        max: safeMax,
        percent: safeMax > 0 ? Math.min(100, Math.round((safeValue / safeMax) * 100)) : 0,
        error: null,
        doneNodes: done,
        gpuUtilization,
        updatedAt: now,
      };
    }
    case 'executing': {
      if (data.node === null || data.node === undefined) {
        if (previous === null) return null;
        return {
          ...previous,
          status: 'completed',
          percent: 100,
          node: null,
          doneNodes: previous.node !== null && previous.node !== undefined ? addDone([previous.node]) : done,
          updatedAt: now,
        };
      }
      const nodeId = String(data.node);
      const doneNodes = previous?.node !== null && previous?.node !== undefined && previous.node !== nodeId
        ? addDone([previous.node])
        : done;
      return {
        promptId: typeof data.prompt_id === 'string' ? data.prompt_id : previous?.promptId ?? null,
        status: 'running',
        node: nodeId,
        value: previous?.value ?? 0,
        max: previous?.max ?? 0,
        percent: previous?.percent ?? 0,
        error: null,
        doneNodes,
        gpuUtilization,
        updatedAt: now,
      };
    }
    case 'execution_cached': {
      if (previous === null) return null;
      return {
        ...previous,
        doneNodes: addDone(Array.isArray(data.nodes) ? data.nodes : []),
        updatedAt: now,
      };
    }
    case 'executed': {
      if (previous === null) return null;
      const nodeId = typeof data.node === 'string' || typeof data.node === 'number' ? String(data.node) : null;
      return {
        ...previous,
        doneNodes: nodeId === null ? done : addDone([nodeId]),
        updatedAt: now,
      };
    }
    case 'execution_success':
      if (previous === null) return null;
      return {
        ...previous,
        status: 'completed',
        percent: 100,
        node: null,
        doneNodes: previous.node !== null && previous.node !== undefined ? addDone([previous.node]) : done,
        updatedAt: now,
      };
    case 'execution_error': {
      const error = typeof data.exception_message === 'string' ? data.exception_message : typeof data.exception_type === 'string' ? data.exception_type : 'execution error';
      const errorNode = typeof data.node_id === 'string' || typeof data.node_id === 'number' ? String(data.node_id) : previous?.node ?? null;
      return {
        ...(previous ?? { promptId: data.prompt_id ?? null, node: null, value: 0, max: 0, percent: 0, gpuUtilization }),
        status: 'error',
        error,
        node: errorNode,
        doneNodes: done,
        updatedAt: now,
      };
    }
    case 'execution_interrupted':
      if (previous === null) return null;
      return { ...previous, status: 'interrupted', updatedAt: now };
    case 'crystools.monitor': {
      const gpus = Array.isArray(data.gpus) ? data.gpus : [];
      const first = gpus[0];
      const utilization = first !== undefined && first !== null && Number.isFinite(Number(first.gpu_utilization))
        ? Math.max(0, Math.min(100, Math.round(Number(first.gpu_utilization))))
        : null;
      if (utilization === null) return previous;
      return {
        ...(previous ?? { promptId: null, status: 'idle', node: null, value: 0, max: 0, percent: 0, error: null, doneNodes: [] }),
        gpuUtilization: utilization,
        updatedAt: now,
      };
    }
    default:
      return previous;
  }
}

/**
 * @param {string} base normalised ComfyUI base URL.
 * @returns {string} WebSocket URL for that server.
 */
function wsUrl(base) {
  return `${base.replace(/^http/i, 'ws')}/ws`;
}

/**
 * @param {string} base server URL.
 * @returns {string} short stable hash.
 */
function hashOf(base) {
  let hash = 0;
  for (let index = 0; index < base.length; index += 1) hash = (hash * 31 + base.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

/**
 * Create the WebSocket progress tracker.
 * @param {{ WebSocketImpl?: any, reconnectMs?: number }} [options] test seams.
 * @returns {{ clientIdFor: (base: string) => string, ensure: (base: string) => void, snapshot: (base: string) => any | null, close: () => void }}
 */
export function createProgressTracker(options = {}) {
  const WebSocketImpl = options.WebSocketImpl ?? (typeof WebSocket === 'function' ? WebSocket : null);
  const reconnectMs = Number.isSafeInteger(options.reconnectMs) ? options.reconnectMs : RECONNECT_MS;
  /** @type {Map<string, any>} */
  const entries = new Map();
  let disposed = false;

  /**
   * @param {string} base server URL.
   * @returns {any} tracker entry.
   */
  function entryFor(base) {
    const existing = entries.get(base);
    if (existing !== undefined) return existing;
    const entry = {
      clientId: `dsh-comfy-${hashOf(base)}-${Math.random().toString(36).slice(2, 8)}`,
      socket: null,
      timer: null,
      connecting: false,
      state: null,
    };
    entries.set(base, entry);
    if (entries.size > MAX_ENTRIES) {
      const oldest = [...entries.keys()].find((key) => key !== base);
      if (oldest !== undefined) closeEntry(oldest, entries.get(oldest));
    }
    return entry;
  }

  /**
   * @param {string} base server URL.
   * @param {any} entry tracker entry.
   * @returns {void}
   */
  function schedule(base, entry) {
    if (disposed || entry.timer !== null) return;
    entry.timer = setTimeout(() => {
      entry.timer = null;
      connect(base, entry);
    }, reconnectMs);
    if (typeof entry.timer.unref === 'function') entry.timer.unref();
  }

  /**
   * @param {string} base server URL.
   * @param {any} entry tracker entry.
   * @returns {void}
   */
  function connect(base, entry) {
    if (disposed || WebSocketImpl === null || entry.socket !== null || entry.connecting) return;
    entry.connecting = true;
    let socket;
    try {
      socket = new WebSocketImpl(`${wsUrl(base)}?clientId=${encodeURIComponent(entry.clientId)}`);
    } catch {
      entry.connecting = false;
      schedule(base, entry);
      return;
    }
    entry.socket = socket;
    const onOpen = () => {
      entry.connecting = false;
    };
    const onMessage = (event) => {
      try {
        const message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
        entry.state = reduceProgress(entry.state, message);
      } catch {
        // ignore malformed frames
      }
    };
    const onClose = () => {
      entry.connecting = false;
      if (entry.socket === socket) entry.socket = null;
      schedule(base, entry);
    };
    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onClose);
  }

  /**
   * @param {string} base server URL.
   * @param {any} entry tracker entry.
   * @returns {void}
   */
  function closeEntry(base, entry) {
    if (entry === undefined) return;
    if (entry.timer !== null) clearTimeout(entry.timer);
    entry.timer = null;
    const socket = entry.socket;
    entry.socket = null;
    entry.connecting = false;
    entries.delete(base);
    if (socket !== null) {
      try {
        socket.close();
      } catch {
        // already closed
      }
    }
  }

  return {
    /**
     * @param {string} base server URL.
     * @returns {string} stable client id for prompt submission.
     */
    clientIdFor(base) {
      const entry = entryFor(base);
      connect(base, entry);
      return entry.clientId;
    },
    /**
     * Open the socket without needing a submission (used by `/live`).
     * @param {string} base server URL.
     * @returns {void}
     */
    ensure(base) {
      const entry = entryFor(base);
      connect(base, entry);
    },
    /**
     * @param {string} base server URL.
     * @returns {any | null} latest execution state.
     */
    snapshot(base) {
      return entries.get(base)?.state ?? null;
    },
    /**
     * @returns {void}
     */
    close() {
      disposed = true;
      for (const [base, entry] of [...entries.entries()]) closeEntry(base, entry);
    },
  };
}
