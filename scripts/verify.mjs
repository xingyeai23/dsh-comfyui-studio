#!/usr/bin/env node
/**
 * dsh-comfyui-studio verifier.
 *
 *   node scripts/verify.mjs                              syntax + offline tests
 *   node scripts/verify.mjs --live                       probe and convert real saved workflows
 *   node scripts/verify.mjs --live --generate NAME       run one workflow with tiny overrides
 *   node scripts/verify.mjs --rewrite "一只白猫"          call the installed panel's /rewrite
 *
 * The live half imports the same modules the Host half runs and talks to
 * ComfyUI directly, so it exercises workflow conversion and submission without
 * depending on the Desktop shell's auth layer.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  jobStatus,
  normalizeBaseUrl,
  probeSystem,
  viewImage,
} from '../lib/comfy.js';
import { fetchObjectInfo, fetchUserWorkflow, listUserWorkflows, submitGraph } from '../lib/studio-upstream.js';import { applyOverrides, collectNodeTypes, convertWorkflow, summarizeWorkflow } from '../lib/workflow.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);

/**
 * @param {string} name flag name.
 * @param {string} fallback value when absent.
 * @returns {string} flag value.
 */
function valueOf(name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback;
}

/**
 * @param {string} label check label.
 * @param {boolean} ok result.
 * @returns {void}
 */
function report(label, ok) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) process.exitCode = 1;
}

console.log('== syntax ==');
for (const relative of ['lib/comfy.js', 'lib/studio-upstream.js', 'lib/workflow.js', 'lib/progress.js', 'lib/host.js', 'lib/client.js', 'test/fake-comfy.mjs', 'scripts/verify.mjs']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { stdio: 'inherit' });
  report(`node --check ${relative}`, result.status === 0);
}

console.log('\n== offline tests ==');
const tests = spawnSync(process.execPath, ['--test', path.join('test', '*.test.mjs')], { cwd: root, stdio: 'inherit' });
report('node --test test/*.test.mjs', tests.status === 0);

if (has('--live')) {
  const base = normalizeBaseUrl(valueOf('--base', process.env.DSH_COMFYUI_BASE ?? 'http://127.0.0.1:8188'));
  console.log(`\n== live: ${base} ==`);
  try {
    const system = await probeSystem(base);
    report(`system_stats: ComfyUI ${system.version || 'unknown'} on ${system.os || 'unknown'}`, true);
    const gb = (value) => (typeof value === 'number' ? `${(value / 1024 ** 3).toFixed(1)} GB` : '?');
    for (const device of system.devices) {
      console.log(`  · ${device.name || 'device'}: VRAM ${gb(device.vramFree)} free / ${gb(device.vramTotal)}`);
    }
    const names = await listUserWorkflows(base);
    report(`workflows: ${names.length} saved`, true);
    const converted = new Map();
    for (const name of names) {
      const raw = await fetchUserWorkflow(base, name);
      const summary = summarizeWorkflow(raw);
      const docs = new Map();
      for (const type of collectNodeTypes(raw)) docs.set(type, await fetchObjectInfo(base, type));
      const conversion = convertWorkflow(raw, docs);
      converted.set(name, { conversion, summary });
      const params = conversion.params;
      const detail = conversion.supported
        ? `positive="${(params.positive?.text ?? '').slice(0, 40)}" steps=${params.sampler?.steps ?? '?'} cfg=${params.sampler?.cfg ?? '?'} size=${params.latent ? `${params.latent.width}x${params.latent.height}` : '?'}`
        : (conversion.reasons[0] ?? 'unsupported');
      console.log(`  · ${name} [${summary.outputKind}] ${conversion.supported ? 'OK' : 'SKIP'} — ${detail}`);
      if (conversion.warnings.length > 0) console.log(`      notes: ${conversion.warnings.join(' | ')}`);
    }

    const generateTarget = valueOf('--generate', '');
    if (has('--generate')) {
      const target = generateTarget !== ''
        ? generateTarget
        : names.find((name) => converted.get(name)?.conversion.supported === true) ?? '';
      if (target === '') throw new Error('no runnable saved workflow found');
      const entry = converted.get(target);
      if (entry === undefined) throw new Error(`unknown workflow: ${target}`);
      if (!entry.conversion.supported) throw new Error(`workflow is not supported: ${entry.conversion.reasons.join('; ')}`);
      const applied = applyOverrides(entry.conversion, {
        positive: 'a red apple on a white table, simple studio photo, soft light, masterpiece, best quality, absurdres',
        negative: 'lowres, blurry, watermark',
        steps: 6,
        cfg: 4.5,
        seed: 20261106,
        width: 512,
        height: 512,
        batchSize: 1,
      });
      const startedAt = Date.now();
      const submitted = await submitGraph(base, applied.prompt);
      console.log(`  · submitted ${submitted.promptId} from ${target} (${applied.applied.length} overrides)`);
      let outcome = null;
      while (Date.now() - startedAt < 180000) {
        const status = await jobStatus(base, submitted.promptId, { timeoutMs: 15000 });
        if (status.status === 'completed' || status.status === 'error') {
          outcome = status;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      report(`generation finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`, outcome !== null && outcome.status === 'completed');
      if (outcome !== null && outcome.status === 'completed' && outcome.images.length > 0) {
        const image = await viewImage(base, outcome.images[0]);
        const isPng = image.buffer.length > 8 && image.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        report(`view: ${outcome.images[0].filename} (${image.buffer.length} bytes)`, isPng);
        if (isPng) {
          const target2 = path.join(tmpdir(), `comfyui-studio-verify-${Date.now()}.png`);
          writeFileSync(target2, image.buffer);
          console.log(`  · saved to ${target2}`);
        }
      } else if (outcome !== null) {
        console.log(`  · ${outcome.status}: ${outcome.error ?? 'no images'}`);
        process.exitCode = 1;
      }
    }
  } catch (error) {
    report(`live check failed: ${error instanceof Error ? error.message : String(error)}`, false);
  }
}

if (has('--rewrite')) {
  const text = valueOf('--rewrite', '一只戴红围巾的白猫坐在窗台上');
  const panel = valueOf('--panel', process.env.DSH_WEB_URL ? `${process.env.DSH_WEB_URL.replace(/\/$/, '')}/comfyui-panel` : 'http://127.0.0.1:49153/comfyui-panel');
  console.log(`\n== rewrite via ${panel} ==`);
  try {
    const response = await fetch(`${panel}/rewrite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, mode: 'tags' }),
    });
    const body = await response.json();
    if (!response.ok || body.ok !== true) throw new Error(body.error ?? `HTTP ${response.status}`);
    report(`rewrite (${body.provider}/${body.model})`, true);
    console.log(`  · ${body.text}`);
  } catch (error) {
    report(`rewrite failed: ${error instanceof Error ? error.message : String(error)}`, false);
  }
}

console.log('\n完成。');
