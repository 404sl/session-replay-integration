import test from 'node:test';
import assert from 'node:assert/strict';

import { report } from '../src/index.js';
import { copyFor } from '../src/copy.js';
import { OPEN_EVENT, OPENED_EVENT, PING_EVENT, PONG_EVENT } from '../src/detect.js';

const COPY = copyFor({ lang: 'en' });

// Enough of a document to run the overlay builders end to end, and enough of a window for
// the two handshakes report() makes before it draws anything. Same reasoning as everywhere
// else here: jsdom would be the first dependency this package has ever had.
function fakeDom({ appWindow = false } = {}) {
  const created = [];

  const makeNode = (name) => {
    const node = {
      nodeName: name,
      style: {},
      children: [],
      attributes: {},
      textContent: '',
      focus() {},
      matches: () => false,
      setAttribute(key, value) {
        node.attributes[key] = String(value);
      },
      getAttribute: (key) => node.attributes[key] ?? null,
      removeAttribute(key) {
        delete node.attributes[key];
      },
      appendChild(child) {
        node.children.push(child);
        return child;
      },
      append(...kids) {
        kids.forEach((kid) => node.children.push(kid));
      },
      remove() {},
      addEventListener() {},
      removeEventListener() {},
      querySelectorAll: () => [],
      contains: () => true,
      select() {},
      setSelectionRange() {}
    };

    created.push(node);

    return node;
  };

  const body = makeNode('BODY');
  const documentElement = makeNode('HTML');
  documentElement.attributes.lang = 'en';

  const listeners = new Map();
  const warnings = [];

  const win = {
    created,
    warnings,
    innerWidth: 1280,
    // The only question isAppWindow asks, and the only one animateIn asks.
    matchMedia: (query) => ({ matches: appWindow && query.includes('display-mode') }),
    getComputedStyle: () => ({ overflow: 'visible', paddingRight: '0px' }),
    requestAnimationFrame: (fn) => fn(),
    setTimeout: (fn) => fn(),
    location: { href: 'https://example.com/checkout' },
    navigator: {},
    console: { warn: (line) => warnings.push(line) },
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) || []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter((it) => it !== fn));
    },
    // Stands in for the content script: it is there, and Chrome refuses to open the panel.
    dispatchEvent(event) {
      const answer = (type, detail) => (listeners.get(type) || []).forEach((fn) => fn({ detail }));

      if (event.type === PING_EVENT) answer(PONG_EVENT, { version: '1.2.0' });
      if (event.type === OPEN_EVENT) {
        answer(OPENED_EVENT, { opened: false, reason: 'sidePanel.open() rejected' });
      }
    }
  };

  win.document = {
    created,
    body,
    documentElement,
    activeElement: makeNode('BUTTON'),
    createElement: (tag) => makeNode(tag.toUpperCase()),
    createElementNS: (_ns, tag) => makeNode(tag),
    createTextNode: (value) => {
      const node = { nodeName: '#text', textContent: value };
      created.push(node);
      return node;
    },
    contains: () => true,
    addEventListener() {},
    removeEventListener() {},
    defaultView: win
  };

  return win;
}

const textOf = (win) => win.created.map((node) => node.textContent || '').join(' ');

// The bug: an installed PWA has no extension toolbar, so the toolbar advice asks somebody
// to press a button their window does not have.
test('a window with no toolbar is not told to open one', async () => {
  const win = fakeDom({ appWindow: true });

  assert.equal(await report({ win, doc: win.document }), 'blocked');

  const text = textOf(win);

  assert.ok(text.includes(COPY.noToolbarTitle));
  assert.ok(text.includes(COPY.noToolbarNext));
  assert.ok(!text.includes(COPY.blockedTitle));
  // The way out of an app window: carry the page to a browser tab.
  assert.ok(text.includes('https://example.com/checkout'));
  assert.ok(text.includes(COPY.copy));
});

test('an ordinary window is still told where the button is', async () => {
  const win = fakeDom();

  assert.equal(await report({ win, doc: win.document }), 'blocked');

  const text = textOf(win);

  assert.ok(text.includes(COPY.blockedTitle));
  assert.ok(text.includes(COPY.panelBlocked));
  assert.ok(!text.includes(COPY.noToolbarTitle));
});

// Whoever is integrating needs to know which rule Chrome hit, and the console is where
// they look for it.
test('the reason the panel refused reaches the console', async () => {
  const win = fakeDom();

  await report({ win, doc: win.document });

  assert.ok(win.warnings.some((line) => line.includes('sidePanel.open() rejected')));
});
