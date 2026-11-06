import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../lib/host.js';
import { PLUGIN_VERSION } from '../lib/comfy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/**
 * @param {string} relative path below the plugin root.
 * @returns {Promise<string>} file text.
 */
function read(relative) {
  return readFile(path.join(root, relative), 'utf8');
}

test('package.json declares the bundle, client half and display resources', async () => {
  const manifest = JSON.parse(await read('package.json'));
  assert.equal(manifest.name, 'dsh-comfyui-studio');
  assert.equal(manifest.version, PLUGIN_VERSION);
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.dsh.client.immediately, true);
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.publishConfig.access, 'public');
  assert.match(manifest.repository.url, /github\.com\/xingyeai23\/dsh-comfyui-studio/);
  assert.equal(manifest.exports['.'].import, './lib/host.js');
  assert.equal(manifest.exports['./client'].default, './lib/client.js');
  assert.equal(manifest.exports['./locale/*.json'], './locale/*.json');
  assert.equal(manifest.exports['./icon'], './icon.svg');
  for (const required of ['lib', 'locale', 'icon.svg', 'cordis.patch.yml', 'README.md', 'README.en.md', 'LICENSE', 'plugin-index.json']) {
    assert.ok(manifest.files.includes(required), `files must list ${required}`);
  }
});

test('the patch inserts the panel row with the verified defaults', async () => {
  const patch = await read('cordis.patch.yml');
  assert.match(patch, /id: comfyui-panel/);
  assert.match(patch, /name: dsh-comfyui-studio/);
  assert.match(patch, /baseUrl: http:\/\/127\.0\.0\.1:8188/);
  assert.match(patch, /llmProvider: ''/);
  assert.match(patch, /rewriteMaxTokens: 800/);
});

test('the client loader id equals the package name', async () => {
  const client = await read('lib/client.js');
  assert.match(client, /__ModuleLoader__\.load\(\{\s*\n\s*id: 'dsh-comfyui-studio'/);
});

test('host half exports an apply function', () => {
  assert.equal(typeof apply, 'function');
});

test('locale resources carry real display metadata', async () => {
  for (const locale of ['zh', 'en']) {
    const parsed = JSON.parse(await read(`locale/${locale}.json`));
    assert.ok(parsed.meta.title.length > 0);
    assert.ok(parsed.meta.description.length > 20);
  }
});

test('the icon is a small valid SVG', async () => {
  const icon = await read('icon.svg');
  const info = await stat(path.join(root, 'icon.svg'));
  assert.ok(info.size > 0 && info.size < 256 * 1024);
  assert.match(icon.trimStart(), /^<svg[\s>]/);
  assert.match(icon, /<\/svg>\s*$/);
});

test('the README documents the studio, the workflow conversion and AI rewrite', async () => {
  const readme = await read('README.md');
  assert.match(readme, /comfyui-studio/);
  assert.match(readme, /\/comfyui-panel\/workflows/);
  assert.match(readme, /\/comfyui-panel\/generate/);
  assert.match(readme, /\/comfyui-panel\/rewrite/);
  assert.match(readme, /baseUrl/);
});
