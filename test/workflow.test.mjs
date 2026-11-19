import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyOverrides,
  classifyModel,
  cleanA1111Prompt,
  collectNodeTypes,
  convertWorkflow,
  summarizeWorkflow,
} from '../lib/workflow.js';
import { NODE_DOCS, SIMPLE_WORKFLOW, VIDEO_WORKFLOW } from './fake-comfy.mjs';

/**
 * @returns {Map<string, any>} object-info documents for the fixture workflow.
 */
function docs() {
  return new Map(Object.entries(NODE_DOCS));
}

/**
 * @param {any} value workflow JSON.
 * @returns {any} deep clone.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('summarizeWorkflow classifies image, video and subgraph workflows', () => {
  const image = summarizeWorkflow(SIMPLE_WORKFLOW);
  assert.equal(image.outputKind, 'image');
  assert.equal(image.runnable, true);
  assert.equal(image.nodeCount, 7);

  const video = summarizeWorkflow(VIDEO_WORKFLOW);
  assert.equal(video.outputKind, 'video');
  assert.equal(video.runnable, false);
  assert.ok(video.reasons.some((reason) => /视频/.test(reason)));

  const subgraph = summarizeWorkflow({
    nodes: [{ id: 1, type: 'f2fdebf6-dfaf-43b6-9eb2-7f70613cfdc1', mode: 0 }, { id: 2, type: 'SaveImage', mode: 0 }],
    links: [],
    definitions: { subgraphs: [{ id: 'x' }] },
  });
  assert.equal(subgraph.hasSubgraph, true);
  assert.equal(subgraph.runnable, false);
});

test('collectNodeTypes skips frontend-only and bypassed nodes', () => {
  const workflow = clone(SIMPLE_WORKFLOW);
  workflow.nodes.push({ id: 20, type: 'MarkdownNote', mode: 0, inputs: [], outputs: [], widgets_values: [] });
  workflow.nodes.push({ id: 21, type: 'Reroute', mode: 0, inputs: [], outputs: [], widgets_values: [] });
  workflow.nodes.push({ id: 22, type: 'CLIPTextEncode', mode: 4, inputs: [], outputs: [], widgets_values: [] });
  const types = collectNodeTypes(workflow);
  assert.deepEqual([...types].sort(), ['CLIPTextEncode', 'CheckpointLoaderSimple', 'EmptyLatentImage', 'KSampler', 'SaveImage', 'VAEDecode']);
});

test('convertWorkflow builds the API graph and the editable parameter surface', () => {
  const conversion = convertWorkflow(SIMPLE_WORKFLOW, docs());
  assert.equal(conversion.supported, true);
  assert.deepEqual(conversion.reasons, []);
  assert.equal(conversion.outputKind, 'image');

  const prompt = conversion.prompt;
  assert.deepEqual(Object.keys(prompt).sort(), ['1', '2', '3', '4', '5', '6', '7']);
  assert.equal(prompt['1'].class_type, 'CheckpointLoaderSimple');
  assert.equal(prompt['1'].inputs.ckpt_name, 'test-model.safetensors');
  assert.equal(prompt['2'].inputs.text, 'a cat');
  assert.deepEqual(prompt['2'].inputs.clip, ['1', 1]);
  assert.deepEqual(prompt['5'].inputs.model, ['1', 0]);
  assert.deepEqual(prompt['5'].inputs.positive, ['2', 0]);
  assert.deepEqual(prompt['5'].inputs.negative, ['3', 0]);
  assert.deepEqual(prompt['5'].inputs.latent_image, ['4', 0]);
  assert.equal(prompt['5'].inputs.seed, 42);
  assert.equal(prompt['5'].inputs.steps, 20);
  assert.equal(prompt['5'].inputs.cfg, 8);
  assert.equal(prompt['5'].inputs.sampler_name, 'euler');
  assert.equal(prompt['5'].inputs.scheduler, 'normal');
  assert.equal(prompt['5'].inputs.denoise, 1);
  assert.deepEqual(prompt['7'].inputs.images, ['6', 0]);
  assert.equal(prompt['7'].inputs.filename_prefix, 'studio');

  assert.deepEqual(conversion.params.positive, { nodeId: '2', text: 'a cat' });
  assert.deepEqual(conversion.params.negative, { nodeId: '3', text: 'blurry' });
  assert.deepEqual(conversion.params.latent, { nodeId: '4', width: 832, height: 1216, batchSize: 1 });
  assert.equal(conversion.params.sampler.nodeId, '5');
  assert.equal(conversion.params.sampler.seedControl, 'randomize');
  assert.equal(conversion.params.checkpoint, 'test-model.safetensors');
});

test('applyOverrides edits a copy and leaves the converted graph intact', () => {
  const conversion = convertWorkflow(SIMPLE_WORKFLOW, docs());
  const applied = applyOverrides(conversion, {
    positive: 'red apple',
    negative: 'blurry, lowres',
    steps: 6,
    cfg: 4.5,
    seed: 99,
    sampler: 'dpmpp_2m',
    scheduler: 'karras',
    width: 512,
    height: 768,
    batchSize: 2,
  });
  assert.deepEqual(applied.applied.sort(), ['batchSize', 'cfg', 'height', 'negative', 'positive', 'sampler', 'scheduler', 'seed', 'steps', 'width']);
  assert.equal(applied.prompt['2'].inputs.text, 'red apple');
  assert.equal(applied.prompt['3'].inputs.text, 'blurry, lowres');
  assert.equal(applied.prompt['5'].inputs.steps, 6);
  assert.equal(applied.prompt['5'].inputs.cfg, 4.5);
  assert.equal(applied.prompt['5'].inputs.seed, 99);
  assert.equal(applied.prompt['5'].inputs.sampler_name, 'dpmpp_2m');
  assert.equal(applied.prompt['5'].inputs.scheduler, 'karras');
  assert.equal(applied.prompt['4'].inputs.width, 512);
  assert.equal(applied.prompt['4'].inputs.height, 768);
  assert.equal(applied.prompt['4'].inputs.batch_size, 2);
  // the source conversion is untouched
  assert.equal(conversion.prompt['2'].inputs.text, 'a cat');
  assert.equal(conversion.prompt['5'].inputs.steps, 20);
});

test('applyOverrides rejects invalid values', () => {
  const conversion = convertWorkflow(SIMPLE_WORKFLOW, docs());
  assert.throws(() => applyOverrides(conversion, { width: 1001 }), /8 的倍数/);
  assert.throws(() => applyOverrides(conversion, { steps: 0 }), /整数/);
  assert.throws(() => applyOverrides(conversion, { cfg: 500 }), /数字/);
});

test('widget values fall back to object-info order for legacy workflows', () => {
  const workflow = clone(SIMPLE_WORKFLOW);
  const sampler = workflow.nodes.find((node) => node.type === 'KSampler');
  sampler.inputs = sampler.inputs.filter((input) => input.link !== null);
  const conversion = convertWorkflow(workflow, docs());
  assert.equal(conversion.supported, true);
  assert.equal(conversion.prompt['5'].inputs.seed, 42);
  assert.equal(conversion.prompt['5'].inputs.steps, 20);
  assert.equal(conversion.prompt['5'].inputs.cfg, 8);
  assert.equal(conversion.prompt['5'].inputs.sampler_name, 'euler');
  assert.equal(conversion.prompt['5'].inputs.scheduler, 'normal');
  assert.equal(conversion.prompt['5'].inputs.denoise, 1);
});

test('unknown node types and video workflows are reported, not guessed', () => {
  const workflow = clone(SIMPLE_WORKFLOW);
  workflow.nodes.push({ id: 30, type: 'SomeCustomNode', mode: 0, inputs: [], outputs: [], widgets_values: [] });
  const unknown = convertWorkflow(workflow, docs());
  assert.equal(unknown.supported, false);
  assert.ok(unknown.reasons.some((reason) => /SomeCustomNode/.test(reason)));

  const video = convertWorkflow(VIDEO_WORKFLOW, new Map());
  assert.equal(video.supported, false);
  assert.ok(video.reasons.some((reason) => /视频|子图|输出/.test(reason)));
});

test('missing required links are reported as unsupported', () => {
  const workflow = clone(SIMPLE_WORKFLOW);
  const sampler = workflow.nodes.find((node) => node.type === 'KSampler');
  sampler.inputs = sampler.inputs.filter((input) => input.name !== 'model');
  const conversion = convertWorkflow(workflow, docs());
  assert.equal(conversion.supported, false);
  assert.ok(conversion.reasons.some((reason) => /缺少必需输入 model/.test(reason)));
});

test('A1111 metadata and LoRA tags are cleaned and reference parameters restored', () => {
  const workflow = clone(SIMPLE_WORKFLOW);
  const positive = workflow.nodes.find((node) => node.id === 2);
  positive.widgets_values = [
    'a cat, solo, <lora:test-lora:0.8>Negative prompt: blurry, watermark,Steps: 30, CFG scale: 3, Sampler: Euler a, Seed: 123456, width: 1024, height: 512, Schedule type: Karras',
  ];
  const conversion = convertWorkflow(workflow, docs());
  assert.equal(conversion.supported, true);
  assert.equal(conversion.params.positive.text, 'a cat, solo');
  assert.equal(conversion.prompt['2'].inputs.text, 'a cat, solo');
  assert.equal(conversion.prompt['5'].inputs.steps, 30);
  assert.equal(conversion.prompt['5'].inputs.cfg, 3);
  assert.equal(conversion.prompt['5'].inputs.sampler_name, 'euler_ancestral');
  assert.equal(conversion.prompt['5'].inputs.scheduler, 'karras');
  assert.equal(conversion.prompt['5'].inputs.seed, 123456);
  // A1111 width/height describe the upscaled reference, not the base latent.
  assert.equal(conversion.prompt['4'].inputs.width, 832);
  assert.equal(conversion.prompt['4'].inputs.height, 1216);
  assert.ok(conversion.warnings.some((warning) => /放大后的尺寸/.test(warning)));
  assert.equal(conversion.cleanup.applied, true);
  assert.deepEqual(conversion.cleanup.loras.map((lora) => lora.name), ['test-lora']);
  assert.ok(conversion.warnings.some((warning) => /A1111/.test(warning)));
  assert.ok(conversion.warnings.some((warning) => /lora/.test(warning)));
});

test('cleanA1111Prompt handles mapping and LoRA tag stripping directly', () => {
  const cleaned = cleanA1111Prompt('masterpiece, 1girl, <lora:styleA:0.6>Negative prompt: bad hands Steps: 28, CFG scale: 4.5, Sampler: DPM++ 2M, Schedule type: Karras, Seed: 7');
  assert.equal(cleaned.cleaned, true);
  assert.equal(cleaned.positive, 'masterpiece, 1girl');
  assert.equal(cleaned.embeddedNegative, 'bad hands');
  assert.equal(cleaned.params.steps, 28);
  assert.equal(cleaned.params.cfg, 4.5);
  assert.equal(cleaned.params.sampler, 'dpmpp_2m');
  assert.equal(cleaned.params.scheduler, 'karras');
  assert.equal(cleaned.params.seed, 7);
  assert.deepEqual(cleaned.loras, [{ name: 'styleA', weight: 0.6 }]);

  const tagsOnly = cleanA1111Prompt('a cat, <lora:missing:1>');
  assert.equal(tagsOnly.cleaned, true);
  assert.equal(tagsOnly.positive, 'a cat');
  assert.deepEqual(tagsOnly.loras, [{ name: 'missing', weight: 1 }]);

  const untouched = cleanA1111Prompt('a plain prompt');
  assert.equal(untouched.cleaned, false);
  assert.equal(untouched.positive, 'a plain prompt');
});

test('missing model files are reported and make the workflow unsupported', () => {
  const workflow = clone(SIMPLE_WORKFLOW);
  const checkpoint = workflow.nodes.find((node) => node.id === 1);
  checkpoint.widgets_values = ['missing-model.safetensors'];
  const conversion = convertWorkflow(workflow, docs());
  assert.equal(conversion.supported, false);
  assert.equal(conversion.missingAssets.length, 1);
  assert.equal(conversion.missingAssets[0].value, 'missing-model.safetensors');
  assert.equal(conversion.missingAssets[0].classType, 'CheckpointLoaderSimple');
  assert.ok(conversion.reasons.some((reason) => /missing-model\.safetensors/.test(reason)));
});

test('classifyModel picks the prompt style from the model name', () => {
  assert.equal(classifyModel('anima_baseV10.safetensors'), 'tags');
  assert.equal(classifyModel('chenkinNoobXLCKXL_v05.safetensors'), 'tags');
  assert.equal(classifyModel('illustriousXL_v01.safetensors'), 'tags');
  assert.equal(classifyModel('flux1-dev.safetensors'), 'natural');
  assert.equal(classifyModel('sd3.5_large.safetensors'), 'natural');
  assert.equal(classifyModel('qwen_image_20b.safetensors'), 'natural');
  assert.equal(classifyModel('some-new-model.safetensors'), 'both');
});

test('applyOverrides edits LoRA loaders and bypasses disabled ones end to end', () => {
  const converted = {
    params: { positive: null, negative: null, sampler: null, latent: null },
    prompt: {
      1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'base.safetensors' } },
      2: {
        class_type: 'LoraLoader',
        inputs: { lora_name: 'old.safetensors', strength_model: 1, strength_clip: 1, model: ['1', 0], clip: ['1', 0] },
      },
      3: { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['4', 0], negative: ['4', 0], latent_image: ['5', 0], seed: 1 } },
      4: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: 'hello' } },
      5: { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
    },
  };

  const edited = applyOverrides(converted, {
    loras: [{ nodeId: '2', name: 'new.safetensors', model: 0.7, clip: 0.4, enabled: true }],
  });
  assert.equal(edited.prompt['2'].inputs.lora_name, 'new.safetensors');
  assert.equal(edited.prompt['2'].inputs.strength_model, 0.7);
  assert.equal(edited.prompt['2'].inputs.strength_clip, 0.4);
  assert.ok(edited.applied.includes('lora:2'));

  const bypassed = applyOverrides(converted, {
    loras: [{ nodeId: '2', name: 'new.safetensors', model: 0.7, clip: 0.4, enabled: false }],
  });
  assert.equal(bypassed.prompt['2'], undefined);
  assert.deepEqual(bypassed.prompt['3'].inputs.model, ['1', 0]);
  assert.deepEqual(bypassed.prompt['4'].inputs.clip, ['1', 0]);
  assert.ok(bypassed.applied.includes('loraBypass'));
  // the original conversion object is never mutated
  assert.equal(converted.prompt['2'].inputs.lora_name, 'old.safetensors');
});

test('linked widget values still consume their widgets_values slot', () => {
  const workflow = clone(SIMPLE_WORKFLOW);
  const latent = workflow.nodes.find((node) => node.id === 4);
  latent.type = 'EmptyFlux2LatentImage';
  latent.inputs = [
    { name: 'width', type: 'INT', widget: { name: 'width' }, link: 10 },
    { name: 'height', type: 'INT', widget: { name: 'height' }, link: 11 },
    { name: 'batch_size', type: 'INT', widget: { name: 'batch_size' }, link: null },
  ];
  latent.widgets_values = [848, 1280, 1];
  workflow.nodes.push({ id: 20, type: 'PrimitiveNode', mode: 0, inputs: [], outputs: [], widgets_values: [848] });
  workflow.nodes.push({ id: 21, type: 'PrimitiveNode', mode: 0, inputs: [], outputs: [], widgets_values: [1280] });
  workflow.links.push([10, 20, 0, 4, 0, 'INT']);
  workflow.links.push([11, 21, 0, 4, 1, 'INT']);

  const objectInfo = docs();
  objectInfo.set('EmptyFlux2LatentImage', {
    input: { required: { width: ['INT', {}], height: ['INT', {}], batch_size: ['INT', {}] } },
    output: ['LATENT'],
  });
  const conversion = convertWorkflow(workflow, objectInfo);
  assert.equal(conversion.prompt['4'].inputs.width, 848);
  assert.equal(conversion.prompt['4'].inputs.height, 1280);
  assert.equal(conversion.prompt['4'].inputs.batch_size, 1);
});

test('seed_widgets controls do not shift following widget values', () => {
  const workflow = clone(SIMPLE_WORKFLOW);
  const sampler = workflow.nodes.find((node) => node.id === 5);
  sampler.type = 'SelfLiftH3Sampler';
  sampler.widgets_values = [1004877498345751, 'randomize', 30, 4, 'er_sde', 'simple', 1];
  workflow.extensions = { seed_widgets: { 5: 0 } };

  const objectInfo = docs();
  objectInfo.set('SelfLiftH3Sampler', {
    input: {
      required: {
        seed: ['INT', {}],
        steps: ['INT', {}],
        cfg: ['FLOAT', {}],
        sampler_name: ['COMBO', { options: ['er_sde', 'euler'] }],
        scheduler: ['COMBO', { options: ['simple', 'normal'] }],
        denoise: ['FLOAT', {}],
      },
    },
    output: ['LATENT'],
  });
  const conversion = convertWorkflow(workflow, objectInfo);
  assert.equal(conversion.prompt['5'].inputs.seed, 1004877498345751);
  assert.equal(conversion.prompt['5'].inputs.steps, 30);
  assert.equal(conversion.prompt['5'].inputs.cfg, 4);
  assert.equal(conversion.prompt['5'].inputs.sampler_name, 'er_sde');
  assert.equal(conversion.prompt['5'].inputs.scheduler, 'simple');
  assert.equal(conversion.prompt['5'].inputs.denoise, 1);
});

test('extractParams and applyOverrides support split samplers, Flux/SD3/GGUF, LoadImage, denoise and checkpoint', () => {
  const workflow = {
    id: 'flux-split',
    revision: 1,
    nodes: [
      { id: 1, type: 'UnetLoaderGGUF', mode: 0, inputs: [], outputs: [{ name: 'MODEL', type: 'MODEL', links: [1] }], widgets_values: ['flux1-dev-Q4.gguf'] },
      { id: 2, type: 'CLIPTextEncodeFlux', mode: 0, inputs: [], outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [2] }], widgets_values: ['a cat', 'a cute cat in sunlight', 3.5] },
      { id: 3, type: 'BasicGuider', mode: 0, inputs: [{ name: 'model', type: 'MODEL', link: 1 }, { name: 'conditioning', type: 'CONDITIONING', link: 2 }], outputs: [{ name: 'GUIDER', type: 'GUIDER', links: [3] }], widgets_values: [] },
      { id: 4, type: 'RandomNoise', mode: 0, inputs: [], outputs: [{ name: 'NOISE', type: 'NOISE', links: [4] }], widgets_values: [777, 'randomize'] },
      { id: 5, type: 'BasicScheduler', mode: 0, inputs: [{ name: 'model', type: 'MODEL', link: 1 }], outputs: [{ name: 'SIGMAS', type: 'SIGMAS', links: [5] }], widgets_values: ['simple', 20, 1.0] },
      { id: 6, type: 'KSamplerSelect', mode: 0, inputs: [], outputs: [{ name: 'SAMPLER', type: 'SAMPLER', links: [6] }], widgets_values: ['euler'] },
      { id: 7, type: 'EmptySD3LatentImage', mode: 0, inputs: [], outputs: [{ name: 'LATENT', type: 'LATENT', links: [7] }], widgets_values: [1024, 1024, 1] },
      { id: 8, type: 'SamplerCustomAdvanced', mode: 0, inputs: [{ name: 'noise', type: 'NOISE', link: 4 }, { name: 'guider', type: 'GUIDER', link: 3 }, { name: 'sampler', type: 'SAMPLER', link: 6 }, { name: 'sigmas', type: 'SIGMAS', link: 5 }, { name: 'latent_image', type: 'LATENT', link: 7 }], outputs: [{ name: 'output', type: 'LATENT', links: [8] }], widgets_values: [] },
      { id: 9, type: 'LoadImage', mode: 0, inputs: [], outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }], widgets_values: ['ref.png', 'image'] },
      { id: 10, type: 'SaveImage', mode: 0, inputs: [{ name: 'images', type: 'IMAGE', link: 8 }], outputs: [], widgets_values: ['flux'] },
    ],
    links: [
      [1, 1, 0, 3, 0, 'MODEL'],
      [2, 2, 0, 3, 1, 'CONDITIONING'],
      [3, 3, 0, 8, 1, 'GUIDER'],
      [4, 4, 0, 8, 0, 'NOISE'],
      [5, 5, 0, 8, 3, 'SIGMAS'],
      [6, 6, 0, 8, 2, 'SAMPLER'],
      [7, 7, 0, 8, 5, 'LATENT'],
      [8, 8, 0, 10, 0, 'IMAGE'],
    ],
  };
  const objectInfo = docs();
  objectInfo.set('UnetLoaderGGUF', { input: { required: { unet_name: [['flux1-dev-Q4.gguf', 'flux1-schnell-Q4.gguf'], {}] } }, output: ['MODEL'] });
  objectInfo.set('CLIPTextEncodeFlux', { input: { required: { clip_l: ['STRING', {}], t5xxl: ['STRING', {}], guidance: ['FLOAT', {}] } }, output: ['CONDITIONING'] });
  objectInfo.set('BasicGuider', { input: { required: { model: ['MODEL', {}], conditioning: ['CONDITIONING', {}] } }, output: ['GUIDER'] });
  objectInfo.set('RandomNoise', { input: { required: { noise_seed: ['INT', { control_after_generate: true }] } }, output: ['NOISE'] });
  objectInfo.set('BasicScheduler', { input: { required: { model: ['MODEL', {}], scheduler: [['simple', 'normal'], {}], steps: ['INT', {}], denoise: ['FLOAT', {}] } }, output: ['SIGMAS'] });
  objectInfo.set('KSamplerSelect', { input: { required: { sampler_name: [['euler', 'dpmpp_2m'], {}] } }, output: ['SAMPLER'] });
  objectInfo.set('EmptySD3LatentImage', { input: { required: { width: ['INT', {}], height: ['INT', {}], batch_size: ['INT', {}] } }, output: ['LATENT'] });
  objectInfo.set('SamplerCustomAdvanced', { input: { required: { noise: ['NOISE', {}], guider: ['GUIDER', {}], sampler: ['SAMPLER', {}], sigmas: ['SIGMAS', {}], latent_image: ['LATENT', {}] } }, output: ['LATENT'] });
  objectInfo.set('LoadImage', { input: { required: { image: [['ref.png'], {}] } }, output: ['IMAGE'] });

  const conversion = convertWorkflow(workflow, objectInfo);
  assert.equal(conversion.supported, true);
  assert.equal(conversion.params.checkpoint, 'flux1-dev-Q4.gguf');
  assert.equal(conversion.params.positive.text, 'a cute cat in sunlight');
  assert.equal(conversion.params.sampler.seed, 777);
  assert.equal(conversion.params.sampler.steps, 20);
  assert.equal(conversion.params.sampler.denoise, 1);
  assert.equal(conversion.params.latent.width, 1024);
  assert.deepEqual(conversion.params.loadImages, [{ nodeId: '9', image: 'ref.png' }]);

  const edited = applyOverrides(conversion, {
    checkpoint: 'flux1-schnell-Q4.gguf',
    positive: 'a dog in rain',
    seed: 888,
    steps: 8,
    sampler: 'dpmpp_2m',
    scheduler: 'normal',
    denoise: 0.65,
    width: 832,
    height: 1216,
    images: [{ nodeId: '9', image: 'uploaded.png' }],
  });
  assert.equal(edited.prompt['1'].inputs.unet_name, 'flux1-schnell-Q4.gguf');
  assert.equal(edited.prompt['2'].inputs.t5xxl, 'a dog in rain');
  assert.equal(edited.prompt['4'].inputs.noise_seed, 888);
  assert.equal(edited.prompt['5'].inputs.steps, 8);
  assert.equal(edited.prompt['5'].inputs.scheduler, 'normal');
  assert.equal(edited.prompt['5'].inputs.denoise, 0.65);
  assert.equal(edited.prompt['6'].inputs.sampler_name, 'dpmpp_2m');
  assert.equal(edited.prompt['7'].inputs.width, 832);
  assert.equal(edited.prompt['7'].inputs.height, 1216);
  assert.equal(edited.prompt['9'].inputs.image, 'uploaded.png');
});
