import test from 'node:test';
import assert from 'node:assert/strict';

import { copyFor, ENGLISH, TRANSLATIONS } from '../src/copy.js';

// A missing key falls through to English by design, which is what keeps a half-finished
// translation readable - and also what would let a new string ship in English on six of the
// seven languages without anybody noticing. So the states the overlay draws are checked key
// by key.
const SPOKEN_EVERYWHERE = [
  'title',
  'supported',
  'free',
  'install',
  'dismiss',
  'unsupportedTitle',
  'unsupported',
  'unsupportedNext',
  'copy',
  'copied',
  'copyManually',
  'blockedTitle',
  'panelBlocked',
  'noToolbarTitle',
  'noToolbar',
  'noToolbarNext',
  'close',
  'gotIt'
];

test('every language says everything the overlay can say', () => {
  Object.entries(TRANSLATIONS).forEach(([lang, words]) => {
    SPOKEN_EVERYWHERE.forEach((key) => {
      assert.ok(words[key], `${lang} is missing ${key}`);
      assert.notEqual(words[key], ENGLISH[key], `${lang} left ${key} in English`);
    });
  });
});

test('the words come back for the language the page declares', () => {
  assert.equal(copyFor({ lang: 'de' }).noToolbarTitle, TRANSLATIONS.de.noToolbarTitle);
  assert.equal(copyFor({ lang: 'ja' }).noToolbarTitle, ENGLISH.noToolbarTitle);
});
