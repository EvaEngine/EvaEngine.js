#!/usr/bin/env node
/**
 * Post-process emitted declarations after `tsc -p tsconfig.build.json`.
 *
 * 1. rewriteRelativeImportExtensions rewrites .ts specifiers in JS output but
 *    NOT in .d.ts output; consumers could not resolve those specifiers.
 * 2. Ship the hand-written ambient declarations that the public typings
 *    reference (untyped vendor deps, Express request augmentation) and pull
 *    them in from the entry declaration via reference paths.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

//Only relative specifiers are rewritten; bare package specifiers are untouched
const SPECIFIER = /(from\s+['"])(\.\.?\/[^'"]+)\.ts(['"])/g;

let rewritten = 0;
for (const file of walk(distDir)) {
  if (!file.endsWith('.d.ts')) {
    continue;
  }
  const code = fs.readFileSync(file, 'utf8');
  const next = code.replace(SPECIFIER, (_match, head, specifier, tail) => {
    rewritten += 1;
    return `${head}${specifier}.js${tail}`;
  });
  if (next !== code) {
    fs.writeFileSync(file, next);
  }
}

const typesTarget = path.join(distDir, 'types');
fs.mkdirSync(typesTarget, { recursive: true });
for (const name of ['vendor.d.ts', 'express.d.ts']) {
  fs.copyFileSync(path.join(distDir, '..', 'src', 'types', name), path.join(typesTarget, name));
}

const entry = path.join(distDir, 'index.d.ts');
const references = [
  '/// <reference path="./types/vendor.d.ts" />',
  '/// <reference path="./types/express.d.ts" />',
  ''
].join('\n');
const entryCode = fs.readFileSync(entry, 'utf8');
if (!entryCode.startsWith('/// <reference path=')) {
  fs.writeFileSync(entry, references + entryCode);
}

console.log(`rewrite-dts: ${rewritten} specifier(s) rewritten, ambient types shipped`);
