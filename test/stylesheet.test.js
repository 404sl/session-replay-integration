import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { stylesheet } from '../src/stylesheet.js';
import {
  ATTRIBUTION_URL,
  BUTTON_CLASS,
  MARK_TRIANGLE,
  triggerStyle
} from '../src/styles.js';

const css = stylesheet({ version: '0.0.0-test' });

test('it styles every class the markup uses', () => {
  Object.values(BUTTON_CLASS).forEach((name) => {
    assert.ok(css.includes(`.${name} {`), `nothing styles .${name}`);
  });
});

// The whole reason src/styles.js exists. If somebody hand-edits one path's appearance, this
// says so before a pasted snippet and a mounted button start looking like two products.
test('it carries the same declarations the inline path writes', () => {
  const inline = triggerStyle({ inline: true, motion: true });

  assert.ok(css.includes(`border-radius: ${inline.borderRadius};`));
  assert.ok(css.includes(`background: ${inline.background};`));
  assert.ok(css.includes(`min-height: ${inline.minHeight};`));
  // The camelCase-to-kebab conversion, including the vendor-prefixed spelling that needs a
  // leading dash the naive replacement would not add.
  assert.ok(css.includes('-webkit-appearance: none;'));
});

test('the mark travels with it', () => {
  assert.ok(css.includes('data:image/svg+xml,'));
  assert.ok(css.includes(encodeURIComponent(MARK_TRIANGLE)), 'the logo geometry is not in the CSS');
});

// A page that loads the stylesheet and the script - which is what the site's own snippet
// tells people to do - must not end up with two marks side by side.
test('it stands aside for a button the script already marked', () => {
  assert.ok(css.includes(`.${BUTTON_CLASS.trigger}:not([data-sr-mark])::before {`));
});

test('the attribution link is styled, and points where the markup points', () => {
  assert.ok(css.includes(`.${BUTTON_CLASS.link} {`));
  assert.match(ATTRIBUTION_URL, /utm_source=integration/);
});

test('it answers narrow screens and reduced motion', () => {
  assert.ok(css.includes('@media (max-width: 30rem)'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
});

// The file is committed, because a <link> on somebody's site loads it straight from the
// repo's published copy. Same contract dist/session-replay.js is held to in CI.
test('the built file is in step with this generator', async () => {
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const built = await readFile(new URL('../dist/session-replay.css', import.meta.url), 'utf8');

  assert.equal(built, stylesheet({ version }));
});
