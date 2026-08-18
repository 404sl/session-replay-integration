// Builds the single file a site drops in with a script tag.
//
// No bundler. This is three modules of our own with no dependencies, and adding a build
// toolchain would mean a lockfile, a supply chain and a version of Node to keep up with -
// for a concatenation. The npm package ships the ES modules directly; this exists for the
// script-tag path, where a site wants one URL and no build step of its own.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

import { stylesheet } from './src/stylesheet.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Dependency order, because concatenation has no module graph to work it out from.
const SOURCES = [
  'src/styles.js',
  'src/copy.js',
  'src/detect.js',
  'src/identify.js',
  'src/splash.js',
  'src/button.js',
  'src/index.js'
];

// Strips the module syntax that only makes sense across files. Everything ends up in one
// scope inside one IIFE, so the names resolve without it.
function inline(source) {
  return source
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^export\s+\{[^}]*\};\s*$/gm, '')
    .replace(/^export\s+(const|function|async function|class|let)\s/gm, '$1 ')
    .trimEnd();
}

const banner = `/**
 * Session Replay integration
 * https://github.com/404sl/session-replay-integration
 *
 * Adds a "report a bug" button to your own pages. Opens the Session Replay extension when
 * it is installed, and explains where to get it when it is not.
 *
 * Sends nothing anywhere: there is no network request in this file.
 *
 * MIT licensed.
 */`;

const parts = await Promise.all(
  SOURCES.map(async (path) => inline(await readFile(join(here, path), 'utf8')))
);

const bundle = `${banner}
(function () {
  'use strict';

${parts.join('\n\n')}

  // The script tag path wires itself. The npm package does not - importing a module should
  // not reach into the document on its own, and a bundler user calls init() when ready.
  function autoInit() {
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // For pages that render their button later, or want to trigger a report from their own
  // code without an element at all.
  // mountButton is offered, never called for them. A script tag that put a floating
  // button on somebody's page uninvited would be an advert, not an integration.
  window.SessionReplay = Object.assign(window.SessionReplay || {}, {
    report,
    init,
    isAvailable,
    identify,
    createButton,
    mountButton,
    // For a page that renders a placeholder after load and would rather say so than call
    // init() again.
    renderPlaceholders
  });
}());
`;

// src/stylesheet.js is deliberately not in SOURCES: it serialises the styles that the
// browser code applies directly, so shipping it to a visitor would be bytes nothing reads.
const { version } = JSON.parse(await readFile(join(here, 'package.json'), 'utf8'));
const css = stylesheet({ version });

await mkdir(join(here, 'dist'), { recursive: true });
await writeFile(join(here, 'dist/session-replay.js'), bundle);
await writeFile(join(here, 'dist/session-replay.css'), css);

console.log(`dist/session-replay.js  — ${(bundle.length / 1024).toFixed(1)} KB`);
console.log(`dist/session-replay.css — ${(css.length / 1024).toFixed(1)} KB`);
