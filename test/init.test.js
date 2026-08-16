import test from 'node:test';
import assert from 'node:assert/strict';

import { init, TRIGGER_ATTRIBUTE } from '../src/index.js';

// Stands in for report(), which would otherwise reach for window and the overlay.
const noop = () => {};

// Wiring elements one by one breaks on any site that replaces its DOM - Turbo, React, htmx
// - because the element that gets clicked is a different one from the element that was
// wired. It fails quietly, too: the click just does whatever the markup says, which for the
// usual <a href="#"> is navigate to #. That is exactly what happened on our own site.
function fakeDocument() {
  const listeners = [];

  // Enough of a node for the button builder to assemble one. These examples are about the
  // click delegation, so what it looks like does not matter - only that it can be built.
  const node = () => ({
    style: {},
    children: [],
    attributes: {},
    setAttribute(k, v) {
      this.attributes[k] = String(v);
    },
    getAttribute: () => null,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append() {},
    addEventListener() {},
    removeEventListener() {},
    matches: () => false,
    remove() {}
  });

  return {
    listeners,
    // init() now fills any <div data-session-replay-button></div> the site wrote; these
    // examples are about the click delegation, so there are none to find.
    querySelectorAll: () => [],
    createElement: node,
    createElementNS: node,
    createTextNode: (text) => ({ textContent: text }),
    defaultView: {
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    },
    addEventListener(type, fn, capture) {
      listeners.push({ type, fn, capture });
    },
    // Stands in for a click landing anywhere inside a trigger.
    click(target) {
      let prevented = false;
      const event = {
        target,
        preventDefault() {
          prevented = true;
        }
      };

      listeners.filter(({ type }) => type === 'click').forEach(({ fn }) => fn(event));

      return prevented;
    }
  };
}

const insideTrigger = () => ({ closest: (selector) => (selector === `[${TRIGGER_ATTRIBUTE}]` ? {} : null) });
const elsewhere = () => ({ closest: () => null });

test('listens on the document rather than on each element', () => {
  const doc = fakeDocument();

  assert.equal(init({ doc, onTrigger: noop }), true);
  assert.equal(doc.listeners.length, 1);
});

test('listens in the capture phase, ahead of frameworks that intercept clicks', () => {
  const doc = fakeDocument();

  init({ doc, onTrigger: noop });

  assert.equal(doc.listeners[0].capture, true);
});

// The bug this replaces: an unwired <a href="#"> navigates instead of reporting.
test('stops the browser following a trigger that is a link', () => {
  const doc = fakeDocument();
  init({ doc, onTrigger: noop });

  assert.equal(doc.click(insideTrigger()), true);
});

test('leaves every other click alone', () => {
  const doc = fakeDocument();
  init({ doc, onTrigger: noop });

  assert.equal(doc.click(elsewhere()), false);
});

test('calling it twice does not listen twice', () => {
  const doc = fakeDocument();

  init({ doc, onTrigger: noop });

  assert.equal(init({ doc, onTrigger: noop }), false);
  assert.equal(doc.listeners.length, 1);
});

// An SPA renders its footer after the first run. init() is how it says so, and the guard
// that stops a second listener must not also stop a second placeholder being filled.
test('a later call still fills a placeholder that appeared since', () => {
  const doc = fakeDocument();
  const filled = [];

  doc.querySelectorAll = () => filled.length ? [] : [{
    nodeName: 'DIV',
    getAttribute: () => '',
    appendChild: (child) => filled.push(child)
  }];

  init({ doc, onTrigger: noop });

  assert.equal(filled.length, 1);
  assert.equal(init({ doc, onTrigger: noop }), false);
});
