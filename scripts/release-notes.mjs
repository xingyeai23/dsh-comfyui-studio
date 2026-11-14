#!/usr/bin/env node
/**
 * Print only the changelog section for one version.
 *
 *   node scripts/release-notes.mjs 0.3.8 > /tmp/release-notes.md
 *
 * The release workflow uses this as the GitHub Release body so release notes
 * stay scoped to the current version instead of repeating the whole changelog.
 */
import { readFileSync } from 'node:fs';

const version = String(process.argv[2] ?? '').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('usage: node scripts/release-notes.mjs <semver-version>');
  process.exit(1);
}

const lines = readFileSync('CHANGELOG.md', 'utf8').split(/\r?\n/);
const heading = `## ${version}`;
const notes = [];
let collecting = false;
for (const line of lines) {
  if (/^##\s/.test(line)) {
    if (collecting) break;
    if (line.trim() === heading || line.trim().startsWith(`${heading} `)) {
      collecting = true;
    }
    continue;
  }
  if (collecting) notes.push(line);
}

const body = notes.join('\n').trim();
if (!collecting || body === '') {
  console.error(`CHANGELOG.md has no notes for ${version}`);
  process.exit(1);
}
process.stdout.write(`${body}\n`);
