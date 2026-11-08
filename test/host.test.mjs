import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { apply, createHandler, resolveConfig, rewritePrompt, sanitizeRewrite } from '../lib/host.js';
import { clearModelCache, historyOutcome, historySeed, PLUGIN_VERSION } from '../lib/comfy.js';
import { clearObjectInfoCache, clearNodeCatalogCache } from '../lib/studio-upstream.js';
import { LORA_BYPASSED_WORKFLOW, LORA_ENABLED_WORKFLOW, PNG, SIMPLE_WORKFLOW, startFakeComfy } from './fake-comfy.mjs';

const PREFIX = '/comfyui-panel';

/**
 * Mount the Host plugin against a stub webServer and collect its routes.
 * @returns {Map<string, any>} routes by path.
 */
function mount() {
  const routes = new Map();
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    inject(_names, factory) {
      factory({
        webServer: {
          register(route) {
            routes.set(route.path, route);
            return () => routes.delete(route.path);
          },
        },
        effect(callback) {
          return callback();
        },
      });
    },
    effect(callback) {
      return callback();
    },
  };
  apply(ctx, { baseUrl: 'http://127.0.0.1:8188' });
  return routes;
}

/**
 * Invoke one handler.
 * @param {(req: any, res: any) => Promise<void>} handler route handler.
 * @param {{ method?: string, url?: string, headers?: Record<string, string>, body?: unknown }} [options]
 * @returns {Promise<{ status: number, headers: Record<string, string>, payload: any }>}
 */
function invoke(handler, options = {}) {
  return new Promise((resolve, reject) => {
    let status = 0;
    let headers = {};
    const body = options.body === undefined ? null : typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    const req = Readable.from(body === null ? [] : [Buffer.from(body)]);
    req.method = options.method ?? 'GET';
    req.headers = options.headers ?? {};
    req.url = options.url ?? '/';
    const res = {
      writeHead(code, nextHeaders) {
        status = code;
        headers = nextHeaders ?? {};
      },
      end(payload) {
        resolve({ status, headers, payload });
      },
      destroy() {},
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

/**
 * @param {any} response invoke result.
 * @returns {any} parsed JSON body.
 */
function jsonOf(response) {
  return JSON.parse(typeof response.payload === 'string' ? response.payload : response.payload.toString('utf8'));
}

/**
 * @param {string} baseUrl upstream base.
 * @param {{ discover?: Function, rewrite?: Function }} [deps] test seams.
 * @returns {(req: any, res: any) => Promise<void>} handler.
 */
function handlerFor(baseUrl, deps = {}) {
  return createHandler({
    defaultBaseUrl: baseUrl,
    discoveryPort: 8188,
    requestTimeoutMs: 5000,
    discoverTimeoutMs: 600,
    llmProvider: '',
    llmModel: '',
    rewriteMaxTokens: 800,
    rewriteReasoningEffort: 'low',
  }, {
    discover: async () => ({ found: [{ baseUrl, version: '1.2.3', gpu: 'Fake GPU', os: 'linux' }], scanned: 254, durationMs: 5 }),
    ...deps,
  });
}

test('apply registers one prefix route', () => {
  const routes = mount();
  const route = routes.get(PREFIX);
  assert.ok(route !== undefined);
  assert.equal(route.kind, 'prefix');
  assert.equal(typeof route.handler, 'function');
});

test('resolveConfig clamps values and keeps the LLM options', () => {
  const defaults = resolveConfig(undefined);
  assert.equal(defaults.defaultBaseUrl, 'http://127.0.0.1:8188');
  assert.equal(defaults.discoveryPort, 8188);
  assert.equal(defaults.requestTimeoutMs, 8000);
  assert.equal(defaults.rewriteMaxTokens, 800);
  assert.equal(defaults.rewriteReasoningEffort, 'off');
  const custom = resolveConfig({
    baseUrl: ' 10.0.0.5:8188 ',
    discoveryPort: 99999,
    requestTimeoutMs: 100,
    llmProvider: 'p',
    llmModel: 'm',
    rewriteMaxTokens: 2000,
    rewriteReasoningEffort: 'high',
  });
  assert.equal(custom.defaultBaseUrl, 'http://10.0.0.5:8188');
  assert.equal(custom.discoveryPort, 8188);
  assert.equal(custom.requestTimeoutMs, 8000);
  assert.equal(custom.llmProvider, 'p');
  assert.equal(custom.llmModel, 'm');
  assert.equal(custom.rewriteMaxTokens, 2000);
  assert.equal(custom.rewriteReasoningEffort, 'high');
});

test('sanitizeRewrite strips fences, labels and quotes', () => {
  assert.equal(sanitizeRewrite('```\nmasterpiece, cat\n```', 'tags'), 'masterpiece, cat');
  assert.equal(sanitizeRewrite('Prompt: "a red apple"', 'tags'), 'a red apple');
  assert.equal(sanitizeRewrite('masterpiece,\nbest quality,\ncat', 'tags'), 'masterpiece, best quality, cat');
});

test('rewritePrompt calls the llm service with the low-effort tags prompt', async () => {
  const requests = [];
  const ctx = {
    get(name) {
      if (name === 'llm') {
        return {
          stream: async function* (request) {
            requests.push(request);
            yield { type: 'text-delta', text: 'masterpiece, best quality, ' };
            yield { type: 'text-delta', text: 'white cat, red scarf' };
            yield { type: 'finish', reason: { kind: 'stop' } };
          },
        };
      }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }) };
      return undefined;
    },
  };
  const result = await rewritePrompt(ctx, resolveConfig({}), { text: '一只戴红围巾的白猫', mode: 'tags' });
  assert.equal(result.text, 'masterpiece, best quality, white cat, red scarf');
  assert.equal(result.provider, 'deepseek-account');
  assert.equal(result.model, 'deepseek-flash');
  assert.equal(result.kind, 'tags');
  assert.equal(requests[0].provider, 'deepseek-account');
  assert.equal(requests[0].reasoningEffort, 'off');
  assert.equal(requests[0].messages[0].role, 'user');
  assert.equal(requests[0].messages[0].content[0].type, 'text');
  assert.match(requests[0].system, /danbooru/);
});

test('rewritePrompt retries without reasoning effort when the model rejects it', async () => {
  const requests = [];
  let calls = 0;
  const ctx = {
    get(name) {
      if (name === 'llm') {
        return {
          stream: async function* (request) {
            requests.push(request);
            calls += 1;
            if (calls === 1) {
              yield { type: 'finish', reason: { kind: 'error', failure: { code: 'UNSUPPORTED_REASONING_EFFORT', message: 'no effort' } } };
              return;
            }
            yield { type: 'text-delta', text: 'a polished English prompt' };
            yield { type: 'finish', reason: { kind: 'stop' } };
          },
        };
      }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) };
      return undefined;
    },
  };
  const result = await rewritePrompt(ctx, resolveConfig({}), { text: '一只猫', mode: 'natural' });
  assert.equal(result.text, 'a polished English prompt');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].reasoningEffort, 'off');
  assert.equal(requests[1].reasoningEffort, undefined);
  assert.match(requests[1].system, /natural-language/);
});

test('rewritePrompt supports the model-driven both-kind prompt', async () => {
  const requests = [];
  const ctx = {
    get(name) {
      if (name === 'llm') {
        return {
          stream: async function* (request) {
            requests.push(request);
            yield { type: 'text-delta', text: 'masterpiece, best quality, white cat, red scarf' };
            yield { type: 'text-delta', text: '\nA white cat with a red scarf sits on a windowsill.' };
            yield { type: 'finish', reason: { kind: 'stop' } };
          },
        };
      }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) };
      return undefined;
    },
  };
  const result = await rewritePrompt(ctx, resolveConfig({}), { text: '一只戴红围巾的白猫', kind: 'both' });
  assert.equal(result.kind, 'both');
  assert.match(requests[0].system, /TWO parts/);
  assert.match(result.text, /\n/);
});

test('rewritePrompt rejects empty text', async () => {
  await assert.rejects(() => rewritePrompt({ get: () => undefined }, resolveConfig({}), { text: '  ' }), /不能为空/);
});

test('health, config and live routes report the plugin and upstream facts', async () => {
  const fake = await startFakeComfy();
  const handler = handlerFor(fake.url);
  try {
    const health = await invoke(handler, { url: `${PREFIX}/health` });
    assert.equal(health.status, 200);
    assert.deepEqual(jsonOf(health), { ok: true, plugin: 'comfyui-panel', version: PLUGIN_VERSION, defaultBaseUrl: fake.url });

    const config = await invoke(handler, { url: `${PREFIX}/config` });
    assert.equal(jsonOf(config).discoveryPort, 8188);

    const live = await invoke(handler, { url: `${PREFIX}/live` });
    const liveBody = jsonOf(live);
    assert.equal(liveBody.online, true);
    assert.equal(liveBody.server.version, '0.43.2-test');
    assert.deepEqual(liveBody.queue, { running: 0, pending: 0, runningIds: [], pendingIds: [] });
  } finally {
    await fake.close();
  }
});

test('state route includes models and recent outputs', async () => {
  const fake = await startFakeComfy();
  clearModelCache();
  clearObjectInfoCache();
  fake.complete('old', [{ filename: 'old.png' }]);
  const handler = handlerFor(fake.url);
  try {
    const response = await invoke(handler, { url: `${PREFIX}/state` });
    const body = jsonOf(response);
    assert.equal(body.online, true);
    assert.deepEqual(body.models.checkpoints, ['test-model.safetensors', 'anima_baseV10.safetensors']);
    assert.deepEqual(body.outputs.map((entry) => entry.promptId), ['old']);
  } finally {
    await fake.close();
  }
});

test('workflows list and workflow conversion routes expose the saved workflows', async () => {
  const fake = await startFakeComfy();
  clearObjectInfoCache();
  clearModelCache();
  const handler = handlerFor(fake.url);
  try {
    const list = await invoke(handler, { url: `${PREFIX}/workflows` });
    assert.equal(list.status, 200);
    const listBody = jsonOf(list);
    assert.equal(listBody.workflows.length, 3);
    const simple = listBody.workflows.find((entry) => entry.name === 'simple.json');
    assert.equal(simple.runnable, true);
    assert.equal(simple.outputKind, 'image');
    const video = listBody.workflows.find((entry) => entry.name === 'video.json');
    assert.equal(video.runnable, false);
    const anima = listBody.workflows.find((entry) => entry.name === 'anima.json');
    assert.equal(anima.outputKind, 'image');

    const workflow = await invoke(handler, { url: `${PREFIX}/workflow?name=simple.json` });
    assert.equal(workflow.status, 200);
    const body = jsonOf(workflow);
    assert.equal(body.supported, true);
    assert.equal(body.params.positive.text, 'a cat');
    assert.equal(body.params.sampler.steps, 20);
    assert.equal(body.params.latent.width, 832);
    assert.equal(body.params.checkpoint, 'test-model.safetensors');
    assert.equal(body.cleanup, null);
    assert.deepEqual(body.missingAssets, []);
    assert.ok(Array.isArray(body.graph.nodes));
    assert.ok(body.graph.nodes.length > 0);

    const animaWorkflow = await invoke(handler, { url: `${PREFIX}/workflow?name=anima.json` });
    const animaBody = jsonOf(animaWorkflow);
    assert.equal(animaBody.modelKind, 'tags');
    assert.equal(animaBody.params.negativeFixed, true);
    assert.equal(animaBody.params.negative.text, 'worst quality, low quality, score_1, score_2, score_3, artist name');
    assert.equal(animaBody.params.positive.text, 'masterpiece, best quality, score_7, safe, a cat');

    const fixedGeneration = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers: { 'content-type': 'application/json' },
      body: {
        base: fake.url,
        workflow: 'anima.json',
        overrides: { positive: 'red apple', negative: 'overridden negative', steps: 6, cfg: 4.5, seed: 5, width: 512, height: 512, batchSize: 1 },
      },
    });
    assert.equal(fixedGeneration.status, 200);
    const fixedGraph = fake.state.submitted[fake.state.submitted.length - 1];
    assert.equal(fixedGraph['3'].inputs.text, 'worst quality, low quality, score_1, score_2, score_3, artist name');
    assert.equal(fixedGraph['2'].inputs.text, 'masterpiece, best quality, score_7, safe, red apple');

    const missing = await invoke(handler, { url: `${PREFIX}/workflow?name=missing.json` });
    assert.equal(missing.status, 404);
  } finally {
    await fake.close();
  }
});

test('generate submits an overridden workflow graph', async () => {
  const fake = await startFakeComfy();
  clearObjectInfoCache();
  clearModelCache();
  const handler = handlerFor(fake.url);
  try {
    const response = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers: { 'content-type': 'application/json' },
      body: {
        base: fake.url,
        workflow: 'simple.json',
        overrides: { positive: 'red apple', negative: 'blurry', steps: 6, cfg: 4.5, seed: 7, width: 512, height: 512, batchSize: 1, sampler: 'dpmpp_2m', scheduler: 'karras' },
      },
    });
    assert.equal(response.status, 200);
    const body = jsonOf(response);
    assert.equal(body.kind, 'workflow');
    assert.equal(body.promptId, 'prompt-1');
    const submitted = fake.state.submitted[0];
    assert.equal(submitted['2'].inputs.text, 'red apple');
    assert.equal(submitted['3'].inputs.text, 'blurry');
    assert.equal(submitted['5'].inputs.steps, 6);
    assert.equal(submitted['5'].inputs.cfg, 4.5);
    assert.equal(submitted['5'].inputs.seed, 7);
    assert.equal(submitted['5'].inputs.sampler_name, 'dpmpp_2m');
    assert.equal(submitted['5'].inputs.scheduler, 'karras');
    assert.equal(submitted['4'].inputs.width, 512);
    assert.equal(submitted['4'].inputs.height, 512);
    assert.equal(submitted['7'].class_type, 'SaveImage');
  } finally {
    await fake.close();
  }
});

test('generate rejects unsupported workflows and invalid overrides', async () => {
  const fake = await startFakeComfy();
  clearObjectInfoCache();
  clearModelCache();
  const handler = handlerFor(fake.url);
  try {
    const video = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers: { 'content-type': 'application/json' },
      body: { base: fake.url, workflow: 'video.json', overrides: {} },
    });
    assert.equal(video.status, 400);
    assert.ok(Array.isArray(jsonOf(video).reasons));

    const invalid = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers: { 'content-type': 'application/json' },
      body: { base: fake.url, workflow: 'simple.json', overrides: { width: 1001 } },
    });
    assert.equal(invalid.status, 400);
    assert.match(jsonOf(invalid).error, /8 的倍数/);
  } finally {
    await fake.close();
  }
});

test('generate with no workflow uses the built-in text-to-image graph', async () => {
  const fake = await startFakeComfy();
  clearModelCache();
  const handler = handlerFor(fake.url);
  try {
    const response = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers: { 'content-type': 'application/json' },
      body: {
        base: fake.url,
        workflow: null,
        overrides: {
          checkpoint: 'test-model.safetensors',
          positive: 'a cat',
          negative: 'blurry',
          width: 512,
          height: 512,
          steps: 8,
          cfg: 4,
          seed: 11,
          batchSize: 1,
          sampler: 'euler',
          scheduler: 'normal',
        },
      },
    });
    assert.equal(response.status, 200);
    assert.equal(jsonOf(response).kind, 'builtin');
    const graph = fake.state.submitted[0];
    assert.equal(graph['4'].class_type, 'CheckpointLoaderSimple');
    assert.equal(graph['3'].class_type, 'KSampler');
    assert.equal(graph['9'].class_type, 'SaveImage');
    assert.equal(graph['3'].inputs.steps, 8);
    assert.equal(graph['6'].inputs.text, 'a cat');
  } finally {
    await fake.close();
  }
});

test('job and view routes drive a completed generation', async () => {
  const fake = await startFakeComfy();
  clearObjectInfoCache();
  clearModelCache();
  const handler = handlerFor(fake.url);
  try {
    const submitted = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers: { 'content-type': 'application/json' },
      body: { base: fake.url, workflow: 'simple.json', overrides: { steps: 6, cfg: 4, seed: 3, width: 512, height: 512, batchSize: 1, positive: 'cat', negative: '' } },
    });
    const id = jsonOf(submitted).promptId;
    const queued = await invoke(handler, { url: `${PREFIX}/job?base=${encodeURIComponent(fake.url)}&id=${id}` });
    assert.equal(jsonOf(queued).status, 'queued');
    fake.complete(id, [{ filename: 'made.png' }]);
    const done = await invoke(handler, { url: `${PREFIX}/job?base=${encodeURIComponent(fake.url)}&id=${id}` });
    assert.equal(jsonOf(done).status, 'completed');
    assert.deepEqual(jsonOf(done).images, [{ filename: 'made.png', subfolder: '', type: 'output' }]);
    const image = await invoke(handler, { url: `${PREFIX}/view?base=${encodeURIComponent(fake.url)}&filename=made.png&type=output` });
    assert.equal(image.status, 200);
    assert.equal(image.headers['content-type'], 'image/png');
    assert.deepEqual([...image.payload.subarray(0, 8)], [...PNG.subarray(0, 8)]);
  } finally {
    await fake.close();
  }
});

test('live exposes WebSocket progress and generate submits with its client id', async () => {
  const fake = await startFakeComfy();
  clearObjectInfoCache();
  clearModelCache();
  const progress = {
    ensure(base) { progress.ensured = base; },
    snapshot() { return { status: 'running', value: 5, max: 12, percent: 42, node: '5' }; },
    clientIdFor() { return 'test-client-id'; },
  };
  const handler = handlerFor(fake.url, { progress });
  try {
    const live = await invoke(handler, { url: `${PREFIX}/live` });
    assert.equal(jsonOf(live).progress.percent, 42);
    assert.equal(progress.ensured, fake.url);

    const submitted = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers: { 'content-type': 'application/json' },
      body: { base: fake.url, workflow: 'simple.json', overrides: { positive: 'cat', negative: '', steps: 5, cfg: 4, seed: 1, width: 512, height: 512, batchSize: 1 } },
    });
    assert.equal(submitted.status, 200);
    assert.ok(fake.state.clientIds.includes('test-client-id'));
  } finally {
    await fake.close();
  }
});

test('open route asks the Host to launch the configured ComfyUI in the browser', async () => {
  const opened = [];
  const handler = handlerFor('http://127.0.0.1:8188', {
    openExternal: async (url) => { opened.push(url); },
  });
  const response = await invoke(handler, {
    method: 'POST',
    url: `${PREFIX}/open`,
    headers: { 'content-type': 'application/json' },
    body: { base: 'http://127.0.0.1:8188/' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(opened, ['http://127.0.0.1:8188']);
  const wrongMethod = await invoke(handler, { url: `${PREFIX}/open` });
  assert.equal(wrongMethod.status, 405);
});

test('rewrite route proxies the Host rewrite function and reports failures', async () => {
  const fake = await startFakeComfy();
  const ok = handlerFor(fake.url, {
    rewrite: async (input) => ({ text: `rewritten:${input.text}`, provider: 'p', model: 'm', mode: input.mode }),
  });
  const failing = handlerFor(fake.url, {
    rewrite: async () => { throw new Error('model offline'); },
  });
  try {
    const good = await invoke(ok, {
      method: 'POST',
      url: `${PREFIX}/rewrite`,
      headers: { 'content-type': 'application/json' },
      body: { text: '一只猫', mode: 'tags' },
    });
    assert.equal(good.status, 200);
    assert.equal(jsonOf(good).text, 'rewritten:一只猫');

    const bad = await invoke(failing, {
      method: 'POST',
      url: `${PREFIX}/rewrite`,
      headers: { 'content-type': 'application/json' },
      body: { text: '一只猫', mode: 'tags' },
    });
    assert.equal(bad.status, 502);
    assert.match(jsonOf(bad).error, /model offline/);
  } finally {
    await fake.close();
  }
});

test('interrupt, queue clear and discover routes answer', async () => {
  const fake = await startFakeComfy();
  const handler = handlerFor(fake.url);
  try {
    const interrupt = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/interrupt`,
      headers: { 'content-type': 'application/json' },
      body: { base: fake.url },
    });
    assert.equal(interrupt.status, 200);
    assert.equal(fake.state.interrupts, 1);

    const clear = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/queue/clear`,
      headers: { 'content-type': 'application/json' },
      body: { base: fake.url },
    });
    assert.equal(clear.status, 200);
    assert.equal(fake.state.clears, 1);

    const discover = await invoke(handler, { url: `${PREFIX}/discover` });
    assert.equal(jsonOf(discover).found[0].baseUrl, fake.url);
  } finally {
    await fake.close();
  }
});

test('cross-origin, unknown paths, wrong methods and bad JSON are refused', async () => {
  const fake = await startFakeComfy();
  const handler = handlerFor(fake.url);
  try {
    const forbidden = await invoke(handler, { url: `${PREFIX}/health`, headers: { origin: 'http://evil.example', host: '127.0.0.1:49153' } });
    assert.equal(forbidden.status, 403);
    const notFound = await invoke(handler, { url: `${PREFIX}/nope` });
    assert.equal(notFound.status, 404);
    const wrongMethod = await invoke(handler, { url: `${PREFIX}/live`, method: 'POST' });
    assert.equal(wrongMethod.status, 405);
    const badJson = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/rewrite`,
      headers: { 'content-type': 'application/json' },
      body: '{nope',
    });
    assert.equal(badJson.status, 400);
  } finally {
    await fake.close();
  }
});

test('object-info resolves the requested node documents per type', async () => {
  const fake = await startFakeComfy();
  clearObjectInfoCache();
  const handler = handlerFor(fake.url);
  try {
    const response = await invoke(handler, {
      url: `${PREFIX}/object-info?base=${encodeURIComponent(fake.url)}&types=%20KSampler%20,,CLIPTextEncode,FrontendOnly`,
    });
    assert.equal(response.status, 200);
    const body = jsonOf(response);
    assert.equal(body.ok, true);
    assert.equal(body.baseUrl, fake.url);
    assert.ok(!Number.isNaN(Date.parse(body.capturedAt)));
    assert.deepEqual(Object.keys(body.docs).sort(), ['CLIPTextEncode', 'FrontendOnly', 'KSampler']);
    assert.equal(body.docs.KSampler.output[0], 'LATENT');
    assert.equal(body.docs.CLIPTextEncode.input.required.text[0], 'STRING');
    assert.equal(body.docs.FrontendOnly, null);

    const missingTypes = await invoke(handler, { url: `${PREFIX}/object-info` });
    assert.equal(missingTypes.status, 400);
    const tooMany = await invoke(handler, {
      url: `${PREFIX}/object-info?types=${Array.from({ length: 65 }, (_, index) => `Node${index}`).join(',')}`,
    });
    assert.equal(tooMany.status, 400);
    const longType = await invoke(handler, { url: `${PREFIX}/object-info?types=${'a'.repeat(201)}` });
    assert.equal(longType.status, 400);

    const docRequests = () => fake.state.requests.filter((entry) => entry.method === 'GET' && entry.path.startsWith('/object_info/')).length;
    assert.equal(docRequests(), 3);
    const cachedResponse = await invoke(handler, { url: `${PREFIX}/object-info?types=KSampler` });
    assert.equal(cachedResponse.status, 200);
    assert.equal(docRequests(), 3);

    const wrongMethod = await invoke(handler, { url: `${PREFIX}/object-info?types=KSampler`, method: 'POST' });
    assert.equal(wrongMethod.status, 405);
  } finally {
    await fake.close();
  }
});

test('node-catalog returns a compact sorted node list and caches it', async () => {
  const fake = await startFakeComfy();
  clearNodeCatalogCache();
  const handler = handlerFor(fake.url);
  const catalogRequests = () => fake.state.requests.filter((entry) => entry.method === 'GET' && entry.path === '/object_info').length;
  try {
    const response = await invoke(handler, { url: `${PREFIX}/node-catalog` });
    assert.equal(response.status, 200);
    const body = jsonOf(response);
    assert.equal(body.ok, true);
    assert.equal(body.baseUrl, fake.url);
    assert.ok(!Number.isNaN(Date.parse(body.capturedAt)));
    assert.equal(body.catalog.length, 10);
    for (const entry of body.catalog) {
      assert.deepEqual(Object.keys(entry).sort(), ['category', 'display', 'outputNode', 'type']);
    }
    assert.ok(JSON.stringify(body.catalog).length < 4096);

    const byType = new Map(body.catalog.map((entry) => [entry.type, entry]));
    assert.deepEqual(byType.get('SaveImage'), { type: 'SaveImage', display: 'Save Image', category: 'image/io', outputNode: true });
    assert.deepEqual(byType.get('KSampler'), { type: 'KSampler', display: 'KSampler', category: 'sampling', outputNode: false });
    assert.deepEqual(byType.get('Note'), { type: 'Note', display: 'Note', category: '其它', outputNode: false });
    assert.equal(byType.get('ZetaSampler').outputNode, true);

    const expected = body.catalog.slice().sort((left, right) => left.category.localeCompare(right.category, 'en', { numeric: true })
      || left.display.localeCompare(right.display, 'en', { numeric: true }));
    assert.deepEqual(body.catalog, expected);

    assert.equal(catalogRequests(), 1);
    const again = await invoke(handler, { url: `${PREFIX}/node-catalog` });
    assert.deepEqual(jsonOf(again).catalog, body.catalog);
    assert.equal(catalogRequests(), 1);

    const wrongMethod = await invoke(handler, { url: `${PREFIX}/node-catalog`, method: 'DELETE' });
    assert.equal(wrongMethod.status, 405);
  } finally {
    await fake.close();
  }
});

test('workflows/save validates the request and writes the workflow through', async () => {
  const fake = await startFakeComfy();
  const handler = handlerFor(fake.url);
  const save = (body) => invoke(handler, {
    method: 'POST',
    url: `${PREFIX}/workflows/save`,
    headers: { 'content-type': 'application/json' },
    body,
  });
  try {
    const emptyGraph = { nodes: [], links: [] };
    for (const body of [
      { graph: emptyGraph },
      { name: 'ab', graph: emptyGraph },
      { name: 'a.txt', graph: emptyGraph },
      { name: '../escape.json', graph: emptyGraph },
      { name: 'a\\b.json', graph: emptyGraph },
      { name: '/absolute.json', graph: emptyGraph },
      { name: 'a\u0000.json', graph: emptyGraph },
      { name: 'ok.json', graph: { nodes: {}, links: [] } },
      { name: 'ok.json', graph: { nodes: [] } },
      { name: 'ok.json', graph: [] },
      { name: 'ok.json' },
      { name: 7, graph: emptyGraph },
      { name: 'ok.json', graph: emptyGraph, base: 'ftp://nope' },
    ]) {
      const response = await save(body);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
    const badJson = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/workflows/save`,
      headers: { 'content-type': 'application/json' },
      body: '{nope',
    });
    assert.equal(badJson.status, 400);

    const bigGraph = { nodes: [{ id: 1, type: 'Note', widgets_values: ['x'.repeat(8 * 1024 * 1024)] }], links: [] };
    assert.equal((await save({ name: 'big.json', graph: bigGraph })).status, 400);

    const before = jsonOf(await invoke(handler, { url: `${PREFIX}/workflows` }));
    assert.equal(before.workflows.length, 3);
    const cached = jsonOf(await invoke(handler, { url: `${PREFIX}/workflow?name=simple.json` }));
    assert.equal(cached.params.positive.text, 'a cat');

    // Overwrite with the same revision: only the cache invalidation can make
    // the following /workflow conversion see the edited graph.
    const edited = JSON.parse(JSON.stringify(SIMPLE_WORKFLOW));
    edited.nodes.find((node) => node.id === 2).widgets_values = ['saved cat'];
    const saved = await save({ base: fake.url, name: ' simple.json ', graph: edited });
    assert.equal(saved.status, 200);
    assert.deepEqual(jsonOf(saved), { ok: true, baseUrl: fake.url, name: 'simple.json' });
    assert.ok(fake.state.requests.some((entry) => entry.method === 'POST' && entry.path === '/userdata/workflows%2Fsimple.json'));
    assert.ok(fake.state.writes.some((entry) => entry.name === 'simple.json' && entry.body.nodes.length === edited.nodes.length));

    const refreshed = jsonOf(await invoke(handler, { url: `${PREFIX}/workflow?name=simple.json` }));
    assert.equal(refreshed.params.positive.text, 'saved cat');

    await invoke(handler, { url: `${PREFIX}/workflows` });
    const extra = await save({ base: fake.url, name: 'saved-extra.json', graph: SIMPLE_WORKFLOW });
    assert.equal(extra.status, 200);
    const after = jsonOf(await invoke(handler, { url: `${PREFIX}/workflows` }));
    assert.equal(after.workflows.length, 4);
    assert.ok(after.workflows.some((entry) => entry.name === 'saved-extra.json'));

    const wrongMethod = await invoke(handler, { url: `${PREFIX}/workflows/save` });
    assert.equal(wrongMethod.status, 405);
  } finally {
    await fake.close();
  }
});

test('workflows/delete validates the request, removes the file and drops caches', async () => {
  const fake = await startFakeComfy();
  const handler = handlerFor(fake.url);
  const remove = (body) => invoke(handler, {
    method: 'POST',
    url: `${PREFIX}/workflows/delete`,
    headers: { 'content-type': 'application/json' },
    body,
  });
  try {
    for (const body of [
      {},
      { name: 'a' },
      { name: 'a.txt' },
      { name: '../escape.json' },
      { name: 'a\\b.json' },
      { name: 7 },
      { name: 'ok.json', base: 'ftp://nope' },
    ]) {
      assert.equal((await remove(body)).status, 400, JSON.stringify(body));
    }

    const before = jsonOf(await invoke(handler, { url: `${PREFIX}/workflows` }));
    assert.equal(before.workflows.length, 3);
    const deleted = await remove({ base: fake.url, name: 'video.json' });
    assert.equal(deleted.status, 200);
    assert.deepEqual(jsonOf(deleted), { ok: true, baseUrl: fake.url, name: 'video.json' });
    assert.deepEqual(fake.state.deletes, ['video.json']);
    assert.ok(fake.state.requests.some((entry) => entry.method === 'DELETE' && entry.path === '/userdata/workflows%2Fvideo.json'));
    assert.equal(fake.state.workflows['video.json'], undefined);

    const after = jsonOf(await invoke(handler, { url: `${PREFIX}/workflows` }));
    assert.equal(after.workflows.length, 2);
    assert.equal(after.workflows.some((entry) => entry.name === 'video.json'), false);

    assert.equal((await remove({ base: fake.url, name: 'video.json' })).status, 502);
    const wrongMethod = await invoke(handler, { url: `${PREFIX}/workflows/delete` });
    assert.equal(wrongMethod.status, 405);
  } finally {
    await fake.close();
  }
});

test('object-info, node-catalog, save and delete report upstream failures as 502', async () => {
  const fake = await startFakeComfy();
  clearNodeCatalogCache();
  const handler = handlerFor(fake.url);
  await fake.close();
  const graph = { nodes: [], links: [] };
  const info = await invoke(handler, { url: `${PREFIX}/object-info?types=KSampler` });
  assert.equal(info.status, 502);
  const catalog = await invoke(handler, { url: `${PREFIX}/node-catalog` });
  assert.equal(catalog.status, 502);
  const save = await invoke(handler, {
    method: 'POST',
    url: `${PREFIX}/workflows/save`,
    headers: { 'content-type': 'application/json' },
    body: { name: 'new.json', graph },
  });
  assert.equal(save.status, 502);
  const remove = await invoke(handler, {
    method: 'POST',
    url: `${PREFIX}/workflows/delete`,
    headers: { 'content-type': 'application/json' },
    body: { name: 'new.json' },
  });
  assert.equal(remove.status, 502);
});


test('oversized JSON bodies get a delivered 413 instead of a dropped connection', async () => {
  const handler = handlerFor('http://127.0.0.1:8188');
  const body = 'x'.repeat(600 * 1024);
  const response = await invoke(handler, {
    method: 'POST',
    url: `${PREFIX}/generate`,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', host: 'localhost:5173' },
    body: `{"base":"http://127.0.0.1:8188","workflow":"a.json","pad":"${body}"}`,
  });
  assert.equal(response.status, 413);
  assert.equal(jsonOf(response).ok, false);
});

test('generate enables or bypasses workflow LoRA loaders from quick-edit rows', async () => {
  const fake = await startFakeComfy({
    workflows: { 'lora-bypassed.json': LORA_BYPASSED_WORKFLOW, 'lora-enabled.json': LORA_ENABLED_WORKFLOW },
  });
  clearObjectInfoCache();
  clearModelCache();
  const handler = handlerFor(fake.url);
  const headers = { 'content-type': 'application/json' };
  try {
    const enabled = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers,
      body: {
        base: fake.url,
        workflow: 'lora-bypassed.json',
        overrides: { loras: [{ nodeId: '8', enabled: true, name: 'detail.safetensors', model: 0.8, clip: 0.6 }] },
      },
    });
    assert.equal(enabled.status, 200);
    const first = fake.state.submitted[fake.state.submitted.length - 1];
    assert.equal(first['8'].class_type, 'LoraLoader');
    assert.equal(first['8'].inputs.lora_name, 'detail.safetensors');
    assert.equal(first['8'].inputs.strength_model, 0.8);
    assert.equal(first['8'].inputs.strength_clip, 0.6);
    assert.deepEqual(first['5'].inputs.model, ['8', 0]);
    assert.deepEqual(first['2'].inputs.clip, ['8', 1]);

    const disabled = await invoke(handler, {
      method: 'POST',
      url: `${PREFIX}/generate`,
      headers,
      body: {
        base: fake.url,
        workflow: 'lora-enabled.json',
        overrides: { loras: [{ nodeId: '8', enabled: false }] },
      },
    });
    assert.equal(disabled.status, 200);
    const second = fake.state.submitted[fake.state.submitted.length - 1];
    assert.equal(second['8'], undefined, 'bypassed LoRA must not be submitted');
    assert.deepEqual(second['5'].inputs.model, ['1', 0]);
    assert.deepEqual(second['2'].inputs.clip, ['1', 1]);
  } finally {
    await fake.close();
  }
});


test('history seeds are read back for old and native-canvas results', () => {
  const entry = {
    prompt: [12, 'prompt-id', {
      5: { class_type: 'KSampler', inputs: { seed: 786673253047190, steps: 30 } },
      6: { class_type: 'EmptyLatentImage', inputs: { width: 832 } },
    }, {}, {}],
    outputs: { 7: { images: [{ filename: 'ComfyUI_temp_qssil_00012_.png', subfolder: '', type: 'temp' }] } },
  };
  assert.equal(historySeed(entry), 786673253047190);
  const outcome = historyOutcome(entry);
  assert.equal(outcome.status, 'completed');
  assert.equal(outcome.seed, 786673253047190);
  assert.equal(outcome.images.length, 1);

  const noise = { prompt: { 1: { class_type: 'RandomNoise', inputs: { noise_seed: 42 } } } };
  assert.equal(historySeed(noise), 42);
  assert.equal(historySeed({ prompt: null }), null);
});
