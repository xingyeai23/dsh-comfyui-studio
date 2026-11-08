#!/usr/bin/env node
/**
 * Point the plugin index at a published npm version.
 *
 *   node scripts/sync-release.mjs 0.3.6
 *
 * Used by .github/workflows/release.yml after npm trusted publishing succeeded.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const version = String(process.argv[2] ?? '').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('usage: node scripts/sync-release.mjs <semver-version>');
  process.exit(1);
}

const file = 'plugin-index.json';
const index = JSON.parse(readFileSync(file, 'utf8'));
const versionEntry = index.plugins?.[0]?.versions?.[0];
if (versionEntry === undefined) {
  console.error('plugin-index.json has no plugin version to update');
  process.exit(1);
}

versionEntry.version = version;
versionEntry.publishTimestamp = Math.floor(Date.now() / 1000);
versionEntry.source = { type: 'npm' };
writeFileSync(file, `${JSON.stringify(index, null, 2)}\n`);
console.log(`plugin index -> ${version}`);
