#!/usr/bin/env node
/**
 * Rebuild the plugin index version list from the npm registry.
 *
 *   node scripts/sync-release.mjs 0.3.7
 *
 * Used by .github/workflows/release.yml after npm trusted publishing, and by
 * the manual "Repair plugin index" workflow when the release run could not
 * update the index itself.
 *
 * The index keeps every published version that declares a dsh.bundle manifest,
 * newest first, so the market can offer older versions for rollback.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PACKAGE_NAME = 'dsh-comfyui-studio';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}`;
const version = String(process.argv[2] ?? '').trim();

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('usage: node scripts/sync-release.mjs <semver-version>');
  process.exit(1);
}

/** @param {string} a @param {string} b @returns {number} semver sort */
function compareVersions(a, b) {
  const [aMain, aPre = ''] = a.split('-', 2);
  const [bMain, bPre = ''] = b.split('-', 2);
  const aParts = aMain.split('.').map(Number);
  const bParts = bMain.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (aParts[index] ?? 0) - (bParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  if (aPre === '' && bPre === '') return 0;
  if (aPre === '') return 1;
  if (bPre === '') return -1;
  return aPre.localeCompare(bPre, 'en', { numeric: true });
}

const response = await fetch(REGISTRY_URL, { headers: { accept: 'application/json' } });
if (!response.ok) {
  throw new Error(`npm registry returned ${response.status} for ${PACKAGE_NAME}`);
}
const packument = await response.json();
const target = packument.versions?.[version];
if (target === undefined) {
  throw new Error(`${PACKAGE_NAME}@${version} is not visible on npm yet`);
}
if (!target.dsh?.bundle) {
  throw new Error(`${PACKAGE_NAME}@${version} has no dsh.bundle manifest`);
}

const versions = Object.entries(packument.versions ?? {})
  .filter(([, manifest]) => Boolean(manifest?.dsh?.bundle))
  .map(([publishedVersion]) => {
    const publishedAt = Date.parse(packument.time?.[publishedVersion] ?? '');
    return {
      version: publishedVersion,
      publishTimestamp: Number.isFinite(publishedAt)
        ? Math.floor(publishedAt / 1000)
        : Math.floor(Date.now() / 1000),
      source: { type: 'npm' },
    };
  })
  .sort((a, b) => compareVersions(b.version, a.version));

if (!versions.some((entry) => entry.version === version)) {
  throw new Error(`${PACKAGE_NAME}@${version} was filtered out of the index`);
}

const file = 'plugin-index.json';
const index = JSON.parse(readFileSync(file, 'utf8'));
const plugin = index.plugins?.[0];
if (plugin === undefined) {
  console.error('plugin-index.json has no plugin entry');
  process.exit(1);
}
plugin.versions = versions;
writeFileSync(file, `${JSON.stringify(index, null, 2)}\n`);
console.log(`plugin index -> ${version} (${versions.length} versions)`);
