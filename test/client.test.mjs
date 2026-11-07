import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load the browser bundle in a VM with a fake module loader and React.
 * @returns {Promise<{ id: string, moduleExports: any, source: string }>} loaded module.
 */
async function loadBundle() {
  const source = await readFile(path.join(here, '..', 'lib', 'client.js'), 'utf8');
  let captured = null;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(options) {
          captured = options;
        },
      },
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'lib/client.js' });
  assert.ok(captured !== null, 'bundle must call window.__ModuleLoader__.load');
  class FakeComponent {
    constructor(props) {
      this.props = props;
    }
    setState(patch) {
      this.state = { ...(this.state ?? {}), ...patch };
    }
  }
  const React = {
    Component: FakeComponent,
    Fragment: 'Fragment',
    createElement(type, props, ...children) {
      const nextProps = { ...(props ?? {}) };
      if (children.length === 1) nextProps.children = children[0];
      else if (children.length > 1) nextProps.children = children;
      return { type, props: nextProps, children };
    },
    useState(value) {
      return [typeof value === 'function' ? value() : value, () => {}];
    },
    useEffect() {},
    useRef(value) {
      return { current: value };
    },
    useCallback(fn) {
      return fn;
    },
    useMemo(factory) {
      return factory();
    },
  };
  const moduleExports = captured.factory((name) => {
    if (name === 'react') return React;
    throw new Error(`unexpected require(${name})`);
  });
  return { id: captured.id, moduleExports, source };
}

/**
 * @returns {{ ctx: any, registrations: any[], dictionaries: any[] }} fake context.
 */
function fakeContext() {
  const registrations = [];
  const dictionaries = [];
  return {
    registrations,
    dictionaries,
    ctx: {
      effect(callback) {
        const cleanup = callback();
        return () => {
          if (typeof cleanup === 'function') cleanup();
        };
      },
      locale: {
        register(ns, dicts) {
          dictionaries.push({ ns, dicts });
          return () => {};
        },
        bind() {
          return (key) => key;
        },
        getLocale() {
          return { active: 'zh', locales: [], revision: 1 };
        },
        subscribe() {
          return () => {};
        },
      },
      slots: {
        inject(_name, factory) {
          factory();
          return () => {};
        },
        register(seat, component) {
          registrations.push({ seat, component });
          return () => {};
        },
      },
    },
  };
}

test('client module id matches the package name', async () => {
  const { id } = await loadBundle();
  assert.equal(id, 'dsh-comfyui-studio');
});

test('client exports the host-facing plugin shape', async () => {
  const { moduleExports } = await loadBundle();
  assert.equal(moduleExports.name, 'comfyui-panel-client');
  assert.deepEqual([...moduleExports.inject], ['slots', 'locale']);
  assert.equal(typeof moduleExports.apply, 'function');
});

test('apply registers the sidebar entry and the main studio page', async () => {
  const { moduleExports } = await loadBundle();
  const { ctx, registrations, dictionaries } = fakeContext();
  moduleExports.apply(ctx);
  assert.equal(registrations.length, 2);
  assert.deepEqual(registrations.map((entry) => entry.seat.name).sort(), ['main', 'sidebar.panellist']);

  const panel = registrations.find((entry) => entry.seat.name === 'main');
  assert.equal(panel.seat.key, 'comfyui-panel');
  assert.equal(typeof panel.component, 'function');

  const sidebar = registrations.find((entry) => entry.seat.name === 'sidebar.panellist');
  assert.equal(sidebar.seat.id, 'comfyui-panel');
  assert.equal(sidebar.seat.order, 30);
  assert.equal(typeof sidebar.seat.label(), 'string');
  assert.ok(sidebar.seat.label().length > 0);

  const iconElement = sidebar.component({ size: 18, active: true });
  assert.equal(typeof iconElement.type, 'function');
  const svg = iconElement.type(iconElement.props);
  assert.equal(svg.type, 'svg');
  assert.equal(svg.props.width, 18);

  assert.equal(dictionaries.length, 1);
  assert.equal(dictionaries[0].ns, 'comfyui-panel');
});

test('the studio page renders header, splitter, left controls and preview', async () => {
  const { moduleExports } = await loadBundle();
  const { ctx, registrations } = fakeContext();
  moduleExports.apply(ctx);
  const panel = registrations.find((entry) => entry.seat.name === 'main');
  const rendered = renderComponent(panel.component({ t: (key) => key }));
  assert.ok(rendered !== null && typeof rendered === 'object');
  const children = rendered.children.filter((child) => child !== null && child !== undefined);
  assert.ok(children.some((child) => child.type === 'style'), 'stylesheet must render');
  const page = children.find((child) => typeof child.props?.className === 'string' && child.props.className.split(' ').includes('cs-page'));
  assert.ok(page !== undefined, 'studio page must render');
  assert.equal(page.props['aria-label'], 'ComfyUI 工作室');
  const header = page.children.find((child) => child?.props?.className === 'cs-top');
  const body = page.children.find((child) => typeof child?.props?.className === 'string' && child.props.className.split(' ').includes('cs-body'));
  assert.ok(header !== undefined);
  assert.ok(body !== undefined);
  assert.ok(header.children.some((child) => child?.props?.className === 'cs-stats'), 'metrics strip must render');
  const left = body.children.find((child) => typeof child?.props?.className === 'string' && child.props.className.split(' ').includes('cs-left'));
  const splitter = body.children.find((child) => child?.props?.role === 'separator');
  const right = body.children.find((child) => typeof child?.props?.className === 'string' && child.props.className.split(' ').includes('cs-right'));
  assert.equal(left.props.className, 'cs-left');
  assert.equal(splitter.props.role, 'separator');
  assert.equal(right.props.className, 'cs-right');
  assert.deepEqual(left.children.filter((section) => section !== null && section !== undefined).slice(0, 3).map((section) => section.props['aria-label']), ['工作流选择', '提示词', '参数']);
  assert.equal(right.children[0].props['aria-label'], '生成结果预览');
});

test('the embedded zh and en dictionaries are complete and bilingual', async () => {
  const { moduleExports } = await loadBundle();
  const { ctx, dictionaries } = fakeContext();
  moduleExports.apply(ctx);
  const { dicts } = dictionaries[0];
  assert.deepEqual(Object.keys(dicts).sort(), ['en', 'zh']);
  const zhKeys = Object.keys(dicts.zh).sort();
  assert.deepEqual(zhKeys, Object.keys(dicts.en).sort());
  for (const key of zhKeys) {
    assert.equal(typeof dicts.zh[key], 'string');
    assert.notEqual(dicts.en[key].trim(), '');
  }
  for (const required of ['actions.generate', 'actions.rewrite', 'actions.interrupt', 'actions.decrease', 'prompt.auto', 'section.workflows', 'section.preview', 'banner.offline', 'aria.splitter', 'workflow.none']) {
    assert.ok(zhKeys.includes(required), `missing ${required}`);
  }
});

test('primary buttons use theme colors that stay readable in dark mode', async () => {
  const { source } = await loadBundle();
  assert.match(source, /\.cs-btn--primary \{ background: var\(--dsw-alias-brand-primary, #4d6bfe\); color: var\(--dsw-alias-bg-base\); \}/);
  assert.equal(/color:\s*#fff\b/i.test(source), false, 'no hard-coded white text');
});

/**
 * Collect every element in a (fake-React) tree.
 * @param {any} node element.
 * @param {any[]} [out] accumulator.
 * @returns {any[]} flat elements.
 */
function flatten(node, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out;
  out.push(node);
  for (const child of Array.isArray(node.children) ? node.children : []) flatten(child, out);
  return out;
}

/**
 * Render through function components and the panel error boundary until a host
 * element tree is reached (the fake React has no reconciler).
 * @param {any} element element or null.
 * @returns {any} rendered element.
 */
function renderComponent(element) {
  if (element === null || element === undefined || typeof element !== 'object') return element;
  const type = element.type;
  if (typeof type === 'function' && type.prototype !== undefined && typeof type.prototype.render === 'function') {
    return renderComponent(new type(element.props).render());
  }
  if (typeof type === 'function') {
    return renderComponent(type(element.props));
  }
  return element;
}

test('the studio page exposes the editor entry and no longer renders a preview card', async () => {
  const { moduleExports } = await loadBundle();
  const { ctx, registrations } = fakeContext();
  moduleExports.apply(ctx);
  const panel = registrations.find((entry) => entry.seat.name === 'main');
  const rendered = renderComponent(panel.component({ t: (key) => key }));
  const tree = flatten(rendered);
  const page = tree.find((node) => typeof node.props?.className === 'string' && node.props.className.split(' ').includes('cs-page'));
  assert.ok(page !== undefined);
  assert.equal(tree.some((node) => typeof node.props?.className === 'string' && /cs-graph(\s|$)/.test(node.props.className)), false, 'the old preview card must be gone');
  const workflowSection = tree.find((node) => node.props?.['aria-label'] === '工作流选择');
  assert.ok(workflowSection !== undefined, 'workflow card must render');
  const editButton = flatten(workflowSection).find((node) => node.type === 'button'
    && (Array.isArray(node.children) ? node.children : []).some((child) => child === '编辑'));
  assert.ok(editButton !== undefined, 'workflow card must offer the editor entry');
  assert.equal(editButton.props.disabled, true, 'editor entry waits for a loaded workflow');
});

test('the panel reports exactly one scrollbar owner and no white glow on the FAB', async () => {
  const { source } = await loadBundle();
  assert.match(source, /\.cs-left::-webkit-scrollbar \{ width: 8px; \}/);
  assert.match(source, /\.cs-textarea::-webkit-scrollbar \{ width: 0; height: 0; \}/);
  assert.match(source, /\.cs-thumbs::-webkit-scrollbar \{ width: 0; height: 0; \}/);
  assert.match(source, /\.cs-page::-webkit-scrollbar \{ width: 0; height: 0; \}/);
  assert.match(source, /\.cs-right \{[^}]*padding-bottom: 64px;/);
  assert.match(source, /\.cs-fab \{[^}]*bottom: 16px;/);
  assert.equal(/\.cs-page \{[^}]*padding-bottom:/.test(source), false, 'the page must not reserve a full-width bottom band');
  assert.equal(/box-shadow: 0 8px 22px color-mix\(in srgb, var\(--dsw-alias-label-primary\)/.test(source), false, 'FAB controls must not cast a light halo');
  assert.match(source, /\.cs-fab-batch \{[\s\S]*?box-shadow: 0 6px 16px rgb\(0 0 0 \/ 24%\);/);
});

test('the slide-up workflow editor and image lightbox render from the bundle', async () => {
  const { source } = await loadBundle();
  assert.match(source, /\.cs-editor \{[\s\S]*?will-change: transform;[\s\S]*?transition: transform \.26s cubic-bezier/);
  assert.match(source, /\.cs-editor--enter, \.cs-editor--exiting \{ transform: translate3d\(0, 100%, 0\); \}/);
  assert.match(source, /\.cs-lightbox \{/);
  assert.match(source, /function WorkflowEditor\(props\)/);
  assert.match(source, /function ImageLightbox\(props\)/);
  const { moduleExports } = await loadBundle();
  const { ctx, dictionaries } = fakeContext();
  moduleExports.apply(ctx);
  const zhKeys = Object.keys(dictionaries[0].dicts.zh);
  const enKeys = Object.keys(dictionaries[0].dicts.en);
  assert.deepEqual(zhKeys.sort(), enKeys.sort());
  for (const key of [
    'editor.title', 'editor.name', 'editor.save', 'editor.close', 'editor.delete',
    'editor.deleteWorkflow', 'editor.addNode', 'editor.deleteSelection',
    'lightbox.download', 'lightbox.copy', 'lightbox.delete', 'lightbox.prev', 'lightbox.next',
  ]) {
    assert.ok(zhKeys.includes(key), `missing ${key}`);
    assert.ok(enKeys.includes(key), `missing en ${key}`);
  }
});

/**
 * @returns {Promise<any>} the exposed pure editor helpers.
 */
async function editorInternals() {
  const { moduleExports } = await loadBundle();
  assert.ok(moduleExports.__editorInternals !== undefined, 'editor internals must be exposed for tests');
  return moduleExports.__editorInternals;
}

test('nodes added from the palette get real output types and can be wired', async () => {
  const internals = await editorInternals();
  const doc = { nodes: [], links: [], last_node_id: 0, last_link_id: 0 };
  const previewInfo = {
    input: { required: { images: ['IMAGE', { tooltip: 'image' }] } },
    output: ['IMAGE'],
    output_name: ['图像'],
  };
  const withPreview = internals.addWorkflowNode(doc, 'PreviewImage', previewInfo, 10, 20);
  const preview = withPreview.nodes[0];
  const plain = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(preview.outputs), [{ name: '图像', type: 'IMAGE', links: [] }]);
  assert.deepEqual(plain(preview.inputs), [{ name: 'images', type: 'IMAGE', link: null }]);

  const sourceDoc = {
    nodes: [{ id: 7, type: 'VAEDecode', pos: [0, 0], inputs: [], outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }] }],
    links: [],
    last_node_id: 7,
    last_link_id: 0,
  };
  const merged = { ...withPreview, nodes: [...sourceDoc.nodes, withPreview.nodes[0]], last_node_id: 8 };
  const linked = internals.connectWorkflowNodes(merged, 7, 0, preview.id, 0);
  assert.equal(linked.links.length, 1);
  assert.deepEqual(plain(linked.links[0]), [1, 7, 0, preview.id, 0, 'IMAGE']);
  assert.equal(linked.nodes.find((node) => node.id === preview.id).inputs[0].link, 1);
  assert.deepEqual(plain(linked.nodes.find((node) => node.id === 7).outputs[0].links), [1]);
});

test('link and node removal keep both ends of every connection consistent', async () => {
  const internals = await editorInternals();
  const doc = {
    nodes: [
      { id: 1, type: 'A', pos: [0, 0], inputs: [], outputs: [{ name: 'OUT', type: 'IMAGE', links: [4, 5] }] },
      { id: 2, type: 'B', pos: [0, 0], inputs: [{ name: 'in', type: 'IMAGE', link: 4 }], outputs: [] },
      { id: 3, type: 'C', pos: [0, 0], inputs: [{ name: 'in', type: 'IMAGE', link: 5 }], outputs: [] },
    ],
    links: [[4, 1, 0, 2, 0, 'IMAGE'], [5, 1, 0, 3, 0, 'IMAGE']],
    last_node_id: 3,
    last_link_id: 5,
  };
  const oneLinkRemoved = internals.removeWorkflowLink(doc, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(oneLinkRemoved.links)).map((link) => link[0]), [5]);
  assert.equal(oneLinkRemoved.nodes[1].inputs[0].link, null);
  assert.deepEqual(JSON.parse(JSON.stringify(oneLinkRemoved.nodes[0].outputs[0].links)), [5]);

  const nodeRemoved = internals.removeWorkflowNode(doc, 1);
  assert.equal(nodeRemoved.nodes.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(nodeRemoved.links)), []);
  assert.equal(nodeRemoved.nodes[0].inputs[0].link, null);
});

test('widget slots account for seed control values and named widget values', async () => {
  const internals = await editorInternals();
  const slots = internals.widgetSlotsOf({
    input: {
      required: {
        seed: ['INT', { default: 0, control_after_generate: true }],
        steps: ['INT', { default: 20, min: 1, max: 100 }],
        sampler_name: [['euler', 'er_sde'], {}],
      },
    },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(slots.map((slot) => [slot.name, slot.index, slot.controlIndex]))), [
    ['seed', 0, 1],
    ['steps', 2, null],
    ['sampler_name', 3, null],
  ]);
  const node = {
    id: 1,
    type: 'KSampler',
    widgets_values: [7, 'randomize', 30, 'euler'],
    widgets_values_named: { seed: 7, steps: 30, sampler_name: 'euler' },
    inputs: [
      { name: 'seed', type: 'INT', widget: { name: 'seed' }, link: null },
      { name: 'steps', type: 'INT', widget: { name: 'steps' }, link: null },
      { name: 'sampler_name', type: 'COMBO', widget: { name: 'sampler_name' }, link: null },
    ],
  };
  const updated = internals.applyWidgetValue(node, slots[1], 42, slots);
  assert.deepEqual(JSON.parse(JSON.stringify(updated.widgets_values)), [7, 'randomize', 42, 'euler']);
  assert.equal(updated.widgets_values_named.steps, 42);
  const rows = internals.editorRowsOf(node, {
    input: {
      required: {
        seed: ['INT', { control_after_generate: true }],
        steps: ['INT', {}],
        sampler_name: [['euler', 'er_sde'], {}],
      },
    },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(rows.rows.map((row) => row.kind))), ['widget', 'widget', 'widget']);
});

test('seed control modes and LoRA extraction feed generate overrides', async () => {
  const internals = await editorInternals();
  assert.equal(internals.nextSeedValue(10, 'fixed'), 10);
  assert.equal(internals.nextSeedValue(10, 'increment'), 11);
  assert.equal(internals.nextSeedValue(0, 'decrement'), 4294967295);
  assert.ok(internals.nextSeedValue(10, 'randomize') >= 0);
  assert.equal(internals.nextSeedValue(10, 'randomize') <= 4294967295, true);

  const graph = {
    nodes: [
      { id: 2, type: 'LoraLoader', widgets_values: ['a.safetensors', 1, 1], widgets_values_named: { lora_name: 'a.safetensors', strength_model: 1, strength_clip: 1 }, mode: 0 },
      { id: 3, type: 'LoraLoaderModelOnly', widgets_values: ['b.safetensors', 0.5], widgets_values_named: { lora_name: 'b.safetensors', strength_model: 0.5 }, mode: 4 },
      { id: 4, type: 'KSampler' },
    ],
  };
  const rows = internals.loraNodesOf(graph, [{ nodeId: '2', name: 'c.safetensors', model: 0.8, enabled: false }]);
  assert.equal(rows.length, 2);
  const first = JSON.parse(JSON.stringify(rows[0]));
  const second = JSON.parse(JSON.stringify(rows[1]));
  assert.deepEqual(first, { nodeId: '2', type: 'LoraLoader', name: 'c.safetensors', model: 0.8, clip: 1, enabled: false });
  assert.equal(second.nodeId, '3');
  assert.equal(second.enabled, false, 'a bypassed node defaults to disabled');
  assert.equal(internals.nodeAccentOf({ type: 'KSampler', color: '#123456' }, null), '#123456');
  assert.equal(internals.nodeAccentOf({ type: 'KSampler' }, null), internals.nodeAccentOf({ type: 'KSampler' }, null));
});

test('LoRA quick-edit rows initialize and update the canvas graph', async () => {
  const internals = await editorInternals();
  const graph = {
    nodes: [
      {
        id: 2,
        type: 'LoraLoader',
        mode: 4,
        widgets_values: ['a.safetensors', 1, 1],
        widgets_values_named: { lora_name: 'a.safetensors', strength_model: 1, strength_clip: 1 },
      },
    ],
  };
  const enabled = internals.applyLorasToGraph(graph, [{ nodeId: '2', name: 'b.safetensors', model: 0.5, clip: 0.3, enabled: true }]);
  assert.equal(enabled.nodes[0].mode, 0);
  const values = JSON.parse(JSON.stringify(enabled.nodes[0].widgets_values));
  assert.deepEqual(values, ['b.safetensors', 0.5, 0.3]);
  assert.equal(enabled.nodes[0].widgets_values_named.strength_clip, 0.3);
  // the original graph is untouched
  assert.equal(graph.nodes[0].mode, 4);

  const disabled = internals.applyLorasToGraph(graph, [{ nodeId: '2', enabled: false }]);
  assert.equal(disabled.nodes[0].mode, 4);
  const rows = JSON.parse(JSON.stringify(internals.loraNodesOf(enabled, [])));
  assert.equal(rows[0].enabled, true);
  assert.equal(rows[0].name, 'b.safetensors');
});

test('the lightbox shows the generation seed and the params seed is a plain input', async () => {
  const { source } = await loadBundle();
  assert.match(source, /'lightbox\.seed': '种子'/);
  assert.match(source, /'lightbox\.copySeed': '复制种子'/);
  assert.match(source, /cs-lightbox-seed/);
  assert.match(source, /copyLightboxSeed/);
  assert.match(source, /className: 'cs-input cs-seed-input'/);
  assert.equal(/cs-seed[^']*NumberField/.test(source), false, 'the seed must not use the drag NumberField');
  assert.match(source, /rememberSeeds\(keys, completedSeed\)/);
  assert.match(source, /const historySeed = Number\.isFinite\(Number\(output\?\.seed\)\)/);
  assert.match(source, /const completedSeed = Number\.isFinite\(Number\(data\.seed\)\)/);
  const { moduleExports } = await loadBundle();
  const { ctx, dictionaries } = fakeContext();
  moduleExports.apply(ctx);
  const keys = Object.keys(dictionaries[0].dicts.zh);
  for (const key of ['lightbox.seed', 'lightbox.copySeed', 'lightbox.seedCopied']) assert.ok(keys.includes(key), key);
});

test('the editor can embed the official ComfyUI web UI', async () => {
  const { source } = await loadBundle();
  assert.match(source, /'editor\.native': '原生画布'/);
  assert.match(source, /'editor\.openExternal': '新窗口打开'/);
  assert.match(source, /className: 'cs-editor-native'/);
  assert.match(source, /chooseCanvas\(true\)/);
  assert.match(source, /\.cs-editor-native \{ flex: 1/);
  const { moduleExports } = await loadBundle();
  const { ctx, dictionaries } = fakeContext();
  moduleExports.apply(ctx);
  const zh = dictionaries[0].dicts.zh;
  for (const key of ['editor.native', 'editor.builtin', 'editor.nativeTitle', 'editor.nativeHint', 'editor.openExternal', 'tutorial.nativeTitle', 'tutorial.native']) {
    assert.ok(Object.hasOwn(zh, key), key);
  }
});

test('an offline panel shows a start-ComfyUI prompt and catches render errors', async () => {
  const { source } = await loadBundle();
  assert.match(source, /'offline\.title': '还没有检测到 ComfyUI'/);
  assert.match(source, /'offline\.desc': '请先安装并启动 ComfyUI/);
  assert.match(source, /class PanelErrorBoundary extends React\.Component/);
  assert.match(source, /className: 'cs-offline-page'/);
  assert.match(source, /COMFY_DOWNLOAD_URL = 'https:\/\/www\.comfy\.org\/download'/);
  assert.match(source, /snapshot\.models !== null && typeof snapshot\.models === 'object' \? snapshot\.models : null/);
  assert.match(source, /setInterval\(\(\) => \{[\s\S]*?\}, 5000\);/);
  assert.match(source, /const retryConnection = async/);
  assert.match(source, /\.cs-offline-actions \.cs-btn \{ min-width: 104px; justify-content: center; \}/);
  assert.match(source, /'aria-busy': offlineRetrying/);
  const { moduleExports } = await loadBundle();
  const { ctx, dictionaries } = fakeContext();
  moduleExports.apply(ctx);
  const zh = dictionaries[0].dicts.zh;
  for (const key of ['offline.title', 'offline.desc', 'offline.retry', 'offline.open', 'offline.saveAddress', 'offline.invalidAddress', 'offline.connectFailed', 'offline.step1Title', 'offline.step2Title', 'offline.step3Title', 'offline.download', 'offline.desktopGuide', 'offline.portableGuide', 'offline.github', 'crash.title']) {
    assert.ok(Object.hasOwn(zh, key), key);
  }
});
