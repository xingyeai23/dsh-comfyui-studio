/**
 * A tiny but real HTTP ComfyUI stand-in for the studio plugin's tests.
 *
 * Besides the generation endpoints it serves the userdata workflow list, a
 * fixture frontend workflow, and the `/object_info` documents the converter
 * needs, so the whole workflow → API-prompt path is exercised over real sockets.
 */
import http from 'node:http';

/** A valid 1×1 transparent PNG. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Object-info documents for the fixture workflow's node types. */
export const NODE_DOCS = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['test-model.safetensors', 'anima_baseV10.safetensors'], {}] } },
    output: ['MODEL', 'CLIP', 'VAE'],
    output_name: ['MODEL', 'CLIP', 'VAE'],
  },
  CLIPTextEncode: {
    input: { required: { text: ['STRING', {}], clip: ['CLIP', {}] } },
    output: ['CONDITIONING'],
  },
  EmptyLatentImage: {
    input: { required: { width: ['INT', {}], height: ['INT', {}], batch_size: ['INT', {}] } },
    output: ['LATENT'],
  },
  KSampler: {
    input: {
      required: {
        model: ['MODEL', {}],
        seed: ['INT', { control_after_generate: true }],
        steps: ['INT', {}],
        cfg: ['FLOAT', {}],
        sampler_name: [['euler', 'euler_ancestral', 'dpmpp_2m', 'er_sde'], {}],
        scheduler: [['normal', 'karras', 'simple'], {}],
        positive: ['CONDITIONING', {}],
        negative: ['CONDITIONING', {}],
        latent_image: ['LATENT', {}],
        denoise: ['FLOAT', {}],
      },
    },
    output: ['LATENT'],
  },
  VAEDecode: {
    input: { required: { samples: ['LATENT', {}], vae: ['VAE', {}] } },
    output: ['IMAGE'],
  },
  LoraLoader: {
    input: {
      required: {
        model: ['MODEL', {}],
        clip: ['CLIP', {}],
        lora_name: [['test-lora.safetensors', 'detail.safetensors'], {}],
        strength_model: ['FLOAT', {}],
        strength_clip: ['FLOAT', {}],
      },
    },
    output: ['MODEL', 'CLIP'],
    output_name: ['MODEL', 'CLIP'],
  },
  SaveImage: {
    input: { required: { images: ['IMAGE', {}], filename_prefix: ['STRING', {}] } },
    output: ['IMAGE'],
    output_name: ['images'],
    output_node: true,
  },
};

/**
 * The full `/object_info` catalog: the converter documents above plus the
 * display metadata the node palette uses (including fallbacks for nodes with
 * no display name or category, and a non-output node).
 */
export const CATALOG_DOCS = {
  ...NODE_DOCS,
  CheckpointLoaderSimple: { ...NODE_DOCS.CheckpointLoaderSimple, display_name: 'Load Checkpoint', category: 'model/loaders' },
  CLIPTextEncode: { ...NODE_DOCS.CLIPTextEncode, display_name: 'CLIP Text Encode (Prompt)', category: 'conditioning' },
  EmptyLatentImage: { ...NODE_DOCS.EmptyLatentImage, display_name: 'Empty Latent Image', category: 'latent' },
  KSampler: { ...NODE_DOCS.KSampler, category: 'sampling' },
  VAEDecode: { ...NODE_DOCS.VAEDecode, display_name: 'VAE Decode', category: 'latent' },
  SaveImage: { ...NODE_DOCS.SaveImage, display_name: 'Save Image', category: 'image/io' },
  LoraLoader: { ...NODE_DOCS.LoraLoader, display_name: 'Load LoRA', category: 'model/loaders' },
  PipelineLoader: { input: {}, output: [], display_name: 'Pipeline Loader', category: 'pipeline' },
  ZetaSampler: { input: {}, output: [], display_name: 'Zeta Sampler', category: 'pipeline', output_node: true },
  Note: { input: {}, output: [] },
};

/** A minimal frontend (UI-format) workflow with the standard txt2img nodes. */
export const SIMPLE_WORKFLOW = {
  id: 'fixture-workflow',
  revision: 3,
  last_node_id: 7,
  last_link_id: 9,
  nodes: [
    {
      id: 1,
      type: 'CheckpointLoaderSimple',
      order: 0,
      mode: 0,
      inputs: [{ name: 'ckpt_name', type: 'COMBO', widget: { name: 'ckpt_name' }, link: null }],
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [1] },
        { name: 'CLIP', type: 'CLIP', links: [2, 3] },
        { name: 'VAE', type: 'VAE', links: [4] },
      ],
      widgets_values: ['test-model.safetensors'],
    },
    {
      id: 2,
      type: 'CLIPTextEncode',
      order: 1,
      mode: 0,
      inputs: [
        { name: 'clip', type: 'CLIP', link: 2 },
        { name: 'text', type: 'STRING', widget: { name: 'text' }, link: null },
      ],
      outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [5] }],
      widgets_values: ['a cat'],
    },
    {
      id: 3,
      type: 'CLIPTextEncode',
      order: 2,
      mode: 0,
      inputs: [
        { name: 'clip', type: 'CLIP', link: 3 },
        { name: 'text', type: 'STRING', widget: { name: 'text' }, link: null },
      ],
      outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [6] }],
      widgets_values: ['blurry'],
    },
    {
      id: 4,
      type: 'EmptyLatentImage',
      order: 3,
      mode: 0,
      inputs: [
        { name: 'width', type: 'INT', widget: { name: 'width' }, link: null },
        { name: 'height', type: 'INT', widget: { name: 'height' }, link: null },
        { name: 'batch_size', type: 'INT', widget: { name: 'batch_size' }, link: null },
      ],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [7] }],
      widgets_values: [832, 1216, 1],
    },
    {
      id: 5,
      type: 'KSampler',
      order: 4,
      mode: 0,
      inputs: [
        { name: 'model', type: 'MODEL', link: 1 },
        { name: 'positive', type: 'CONDITIONING', link: 5 },
        { name: 'negative', type: 'CONDITIONING', link: 6 },
        { name: 'latent_image', type: 'LATENT', link: 7 },
        { name: 'seed', type: 'INT', widget: { name: 'seed' }, link: null },
        { name: 'steps', type: 'INT', widget: { name: 'steps' }, link: null },
        { name: 'cfg', type: 'FLOAT', widget: { name: 'cfg' }, link: null },
        { name: 'sampler_name', type: 'COMBO', widget: { name: 'sampler_name' }, link: null },
        { name: 'scheduler', type: 'COMBO', widget: { name: 'scheduler' }, link: null },
        { name: 'denoise', type: 'FLOAT', widget: { name: 'denoise' }, link: null },
      ],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [8] }],
      widgets_values: [42, 'randomize', 20, 8, 'euler', 'normal', 1],
    },
    {
      id: 6,
      type: 'VAEDecode',
      order: 5,
      mode: 0,
      inputs: [
        { name: 'samples', type: 'LATENT', link: 8 },
        { name: 'vae', type: 'VAE', link: 4 },
      ],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [9] }],
      widgets_values: [],
    },
    {
      id: 7,
      type: 'SaveImage',
      order: 6,
      mode: 0,
      inputs: [
        { name: 'images', type: 'IMAGE', link: 9 },
        { name: 'filename_prefix', type: 'STRING', widget: { name: 'filename_prefix' }, link: null },
      ],
      outputs: [],
      widgets_values: ['studio'],
    },
  ],
  links: [
    [1, 1, 0, 5, 0, 'MODEL'],
    [2, 1, 1, 2, 0, 'CLIP'],
    [3, 1, 1, 3, 0, 'CLIP'],
    [4, 1, 2, 6, 1, 'VAE'],
    [5, 2, 0, 5, 1, 'CONDITIONING'],
    [6, 3, 0, 5, 2, 'CONDITIONING'],
    [7, 4, 0, 5, 3, 'LATENT'],
    [8, 5, 0, 6, 0, 'LATENT'],
    [9, 6, 0, 7, 0, 'IMAGE'],
  ],
};

/**
 * Insert a LoRA loader between the checkpoint and the sampler.
 * @param {any} workflow base workflow.
 * @param {number} mode node mode (4 = bypassed, 0 = enabled).
 * @returns {any} workflow with node id 8.
 */
function withLora(workflow, mode) {
  const clone = JSON.parse(JSON.stringify(workflow));
  clone.id = `lora-${mode === 4 ? 'bypassed' : 'enabled'}`;
  clone.nodes.push({
    id: 8,
    type: 'LoraLoader',
    order: 10,
    mode,
    inputs: [
      { name: 'model', type: 'MODEL', link: 1 },
      { name: 'clip', type: 'CLIP', link: 11 },
      { name: 'lora_name', type: 'COMBO', widget: { name: 'lora_name' }, link: null },
      { name: 'strength_model', type: 'FLOAT', widget: { name: 'strength_model' }, link: null },
      { name: 'strength_clip', type: 'FLOAT', widget: { name: 'strength_clip' }, link: null },
    ],
    outputs: [
      { name: 'MODEL', type: 'MODEL', links: [10] },
      { name: 'CLIP', type: 'CLIP', links: [12, 13] },
    ],
    widgets_values: ['test-lora.safetensors', 1, 1],
    widgets_values_named: { lora_name: 'test-lora.safetensors', strength_model: 1, strength_clip: 1 },
  });
  const checkpoint = clone.nodes.find((node) => node.id === 1);
  checkpoint.outputs = [
    { name: 'MODEL', type: 'MODEL', links: [1] },
    { name: 'CLIP', type: 'CLIP', links: [11] },
    { name: 'VAE', type: 'VAE', links: [4] },
  ];
  clone.nodes.find((node) => node.id === 2).inputs.find((input) => input.name === 'clip').link = 12;
  clone.nodes.find((node) => node.id === 3).inputs.find((input) => input.name === 'clip').link = 13;
  clone.nodes.find((node) => node.id === 5).inputs.find((input) => input.name === 'model').link = 10;
  clone.links = [
    [1, 1, 0, 8, 0, 'MODEL'],
    [4, 1, 2, 6, 1, 'VAE'],
    [5, 2, 0, 5, 1, 'CONDITIONING'],
    [6, 3, 0, 5, 2, 'CONDITIONING'],
    [7, 4, 0, 5, 3, 'LATENT'],
    [8, 5, 0, 6, 0, 'LATENT'],
    [9, 6, 0, 7, 0, 'IMAGE'],
    [10, 8, 0, 5, 0, 'MODEL'],
    [11, 1, 1, 8, 1, 'CLIP'],
    [12, 8, 1, 2, 0, 'CLIP'],
    [13, 8, 1, 3, 0, 'CLIP'],
  ];
  clone.last_node_id = 8;
  clone.last_link_id = 13;
  clone.last_node_id = 8;
  return clone;
}

export const LORA_BYPASSED_WORKFLOW = withLora(SIMPLE_WORKFLOW, 4);
export const LORA_ENABLED_WORKFLOW = withLora(SIMPLE_WORKFLOW, 0);

/** A tag-model workflow used to check the fixed anima negative prompt. */
export const ANIMA_WORKFLOW = {
  ...SIMPLE_WORKFLOW,
  id: 'anima-fixture',
  nodes: SIMPLE_WORKFLOW.nodes.map((node) => (node.id === 1
    ? { ...node, widgets_values: ['anima_baseV10.safetensors'] }
    : node)),
};

/** A video workflow the panel must refuse to preview. */
export const VIDEO_WORKFLOW = {
  id: 'video-fixture',
  revision: 1,
  nodes: [
    { id: 1, type: 'SaveVideo', order: 0, mode: 0, inputs: [], outputs: [], widgets_values: ['video'] },
  ],
  links: [],
};

/**
 * Read a request body as text.
 * @param {import('node:http').IncomingMessage} req request.
 * @returns {Promise<string>} body text.
 */
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Start the fake ComfyUI server on an ephemeral port.
 * @param {{ workflows?: Record<string, any>, catalogDocs?: Record<string, any> }} [options]
 * @returns {Promise<any>} fake server handle.
 */
export async function startFakeComfy(options = {}) {
  const state = {
    version: '0.43.2-test',
    checkpoints: ['test-model.safetensors'],
    samplers: ['euler', 'dpmpp_2m', 'er_sde'],
    schedulers: ['normal', 'karras', 'simple'],
    queueRunning: [],
    queuePending: [],
    history: {},
    nextId: 1,
    requests: [],
    submitted: [],
    clientIds: [],
    rejectPrompt: null,
    interrupts: 0,
    clears: 0,
    writes: [],
    deletes: [],
    workflows: options.workflows ?? { 'simple.json': SIMPLE_WORKFLOW, 'anima.json': ANIMA_WORKFLOW, 'video.json': VIDEO_WORKFLOW },
    catalogDocs: options.catalogDocs ?? CATALOG_DOCS,
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const path = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase();
    state.requests.push({ method, path, search: url.search });

    /**
     * @param {number} status HTTP status.
     * @param {unknown} body JSON body.
     * @returns {void}
     */
    const json = (status, body) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': String(Buffer.byteLength(payload)) });
      res.end(payload);
    };

    if (path === '/system_stats' && method === 'GET') {
      return json(200, {
        system: { os: 'linux', ram_total: 64 * 1024 ** 3, ram_free: 32 * 1024 ** 3, comfyui_version: state.version, python_version: '3.13.0', pytorch_version: '2.12.0' },
        devices: [{ name: 'cuda:0 Test GPU', type: 'cuda', index: 0, vram_total: 16 * 1024 ** 3, vram_free: 12 * 1024 ** 3 }],
      });
    }

    if (path === '/userdata' && method === 'GET') {
      if (url.searchParams.get('dir') !== 'workflows') return json(200, []);
      return json(200, Object.keys(state.workflows));
    }

    if (path.startsWith('/userdata/') && method === 'GET') {
      const decoded = decodeURIComponent(path.slice('/userdata/'.length));
      if (!decoded.startsWith('workflows/')) return json(404, { error: 'not found' });
      const name = decoded.slice('workflows/'.length);
      const workflow = state.workflows[name];
      return workflow === undefined ? json(404, { error: 'not found' }) : json(200, workflow);
    }

    if (path.startsWith('/userdata/') && (method === 'POST' || method === 'DELETE')) {
      const decoded = decodeURIComponent(path.slice('/userdata/'.length));
      if (!decoded.startsWith('workflows/')) return json(404, { error: 'not found' });
      const name = decoded.slice('workflows/'.length);
      if (method === 'POST') {
        const raw = await readBody(req);
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return json(400, { error: 'invalid JSON' });
        }
        state.workflows[name] = body;
        state.writes.push({ name, body });
        return json(200, `workflows\\${name}`);
      }
      if (state.workflows[name] === undefined) return json(404, { error: 'not found' });
      delete state.workflows[name];
      state.deletes.push(name);
      res.writeHead(204);
      return res.end();
    }

    if (path.startsWith('/object_info/') && method === 'GET') {
      const type = decodeURIComponent(path.slice('/object_info/'.length));
      const doc = state.catalogDocs[type];
      return doc === undefined ? json(404, { error: 'not found' }) : json(200, { [type]: doc });
    }

    if (path === '/object_info' && method === 'GET') return json(200, state.catalogDocs);

    if (path === '/queue' && method === 'GET') {
      return json(200, { queue_running: state.queueRunning, queue_pending: state.queuePending });
    }

    if (path === '/prompt' && method === 'POST') {
      const raw = await readBody(req);
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch {
        return json(400, { error: { type: 'invalid_json', message: 'invalid JSON' } });
      }
      if (state.rejectPrompt !== null) return json(state.rejectPrompt.status, state.rejectPrompt.body);
      const id = `prompt-${state.nextId}`;
      state.nextId += 1;
      state.submitted.push(body.prompt);
      state.clientIds.push(body.client_id);
      state.queuePending.push([state.nextId, id, body.prompt, {}, []]);
      return json(200, { prompt_id: id, number: state.nextId, node_errors: {} });
    }

    if (path.startsWith('/history/') && method === 'GET') {
      const id = decodeURIComponent(path.slice('/history/'.length));
      return json(200, state.history[id] === undefined ? {} : { [id]: state.history[id] });
    }

    if (path === '/history' && method === 'GET') return json(200, state.history);

    if (path === '/view' && method === 'GET') {
      if (url.searchParams.get('filename') === 'missing.png') return json(404, { error: 'not found' });
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(PNG.length) });
      return res.end(PNG);
    }

    if (path === '/interrupt' && method === 'POST') {
      state.interrupts += 1;
      state.queueRunning = [];
      return json(200, {});
    }

    if (path === '/queue' && method === 'POST') {
      const raw = await readBody(req);
      let body = {};
      try {
        body = raw === '' ? {} : JSON.parse(raw);
      } catch {
        return json(400, { error: 'invalid JSON' });
      }
      if (body.clear === true) {
        state.clears += 1;
        state.queuePending = [];
      }
      return json(200, {});
    }

    return json(404, { error: 'not found' });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  /**
   * @param {string} id prompt id.
   * @param {Array<{ filename: string, subfolder?: string, type?: string }>} [images] output images.
   * @returns {void}
   */
  const complete = (id, images = [{ filename: 'dsh_0001.png', subfolder: '', type: 'output' }]) => {
    state.queuePending = state.queuePending.filter((entry) => entry[1] !== id);
    state.queueRunning = state.queueRunning.filter((entry) => entry[1] !== id);
    state.history[id] = {
      prompt: [0, id, {}, {}, []],
      outputs: { 7: { images: images.map((image) => ({ filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' })) } },
      status: { status_str: 'success', completed: true, messages: [] },
    };
  };

  /**
   * @param {string} id prompt id.
   * @param {string} [message] failure text.
   * @returns {void}
   */
  const fail = (id, message = 'CUDA out of memory') => {
    state.queuePending = state.queuePending.filter((entry) => entry[1] !== id);
    state.queueRunning = state.queueRunning.filter((entry) => entry[1] !== id);
    state.history[id] = {
      prompt: [0, id, {}, {}, []],
      outputs: {},
      status: { status_str: 'error', completed: false, messages: [['execution_error', { exception_message: message }]] },
    };
  };

  /**
   * @param {string} id prompt id.
   * @returns {void}
   */
  const start = (id) => {
    const entry = state.queuePending.find((item) => item[1] === id);
    if (entry === undefined) return;
    state.queuePending = state.queuePending.filter((item) => item[1] !== id);
    state.queueRunning = [entry];
  };

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    state,
    complete,
    fail,
    start,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
