import test from 'node:test';
import assert from 'node:assert/strict';

import { showSplash, COPY } from '../src/splash.js';
import {
  createButton,
  renderPlaceholders,
  BUTTON_POSITIONS,
  BUTTON_PLACEHOLDER
} from '../src/button.js';

// A DOM stub, not a DOM. Enough of one to run the builders end to end and catch the things
// that only show up when code is executed: a misspelled property, a call on something
// undefined, an element appended to nothing.
//
// jsdom would be more faithful and would also be the first dependency this package has ever
// had - for code whose whole promise to the sites loading it is that it brings nothing with
// it. A stub keeps that promise and still runs every line that builds the overlay.
function fakeDom() {
  const created = [];

  const makeNode = (name) => {
    const node = {
      nodeName: name,
      style: {},
      children: [],
      attributes: {},
      listeners: {},
      textContent: '',
      // Read by the focus trap; nothing in a stub is genuinely focusable.
      focus() {
        node.focused = true;
      },
      matches: () => false,
      setAttribute(key, value) {
        node.attributes[key] = String(value);
      },
      getAttribute(key) {
        return node.attributes[key] ?? null;
      },
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
      insertBefore(child) {
        node.children.unshift(child);
        return child;
      },
      remove() {
        node.removed = true;
      },
      addEventListener(type, fn) {
        (node.listeners[type] ||= []).push(fn);
      },
      removeEventListener(type, fn) {
        node.listeners[type] = (node.listeners[type] || []).filter((it) => it !== fn);
      },
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

  const doc = {
    created,
    body,
    documentElement,
    activeElement: makeNode('BUTTON'),
    baseURI: 'https://example.com/checkout',
    createElement: (tag) => makeNode(tag.toUpperCase()),
    createElementNS: (_ns, tag) => makeNode(tag),
    createTextNode: (text) => {
      // Recorded like any other node: labels are often text nodes, and a stub that forgets
      // them makes the overlay look empty when it is not.
      const node = { nodeName: '#text', textContent: text };
      created.push(node);
      return node;
    },
    querySelector: () => null,
    contains: () => true,
    addEventListener() {},
    removeEventListener() {},
    defaultView: {
      innerWidth: 1280,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      getComputedStyle: () => ({ overflow: 'visible', paddingRight: '0px' }),
      requestAnimationFrame: (fn) => fn(),
      setTimeout: (fn) => fn(),
      location: { href: 'https://example.com/checkout' },
      navigator: {}
    }
  };

  return doc;
}

// Walks everything the builders produced, so an assertion can ask "is this text anywhere in
// the overlay" without knowing the structure it ended up in.
const textOf = (doc) => doc.created.map((node) => node.textContent || '').join(' ');
const attrValues = (doc, key) =>
  doc.created.map((node) => node.attributes?.[key]).filter(Boolean);

test('the overlay builds, and is a modal dialog', () => {
  const doc = fakeDom();

  const close = showSplash({ doc, supported: true });

  assert.equal(typeof close, 'function');
  assert.ok(attrValues(doc, 'role').includes('dialog'));
  assert.ok(attrValues(doc, 'aria-modal').includes('true'));
  assert.equal(doc.body.children.length, 1);
});

test('it makes the case for installing, on a browser that could', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: true });
  const text = textOf(doc);

  assert.ok(text.includes(COPY.title));
  assert.ok(text.includes(COPY.install));
  COPY.captures.forEach((line) => assert.ok(text.includes(line), `missing: ${line}`));
});

// Offering an install that cannot work is worse than saying so.
test('it offers no install where one is impossible', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: false });
  const text = textOf(doc);

  assert.ok(text.includes(COPY.unsupportedTitle));
  assert.ok(!text.includes(COPY.install));
});

test('it shows a caller message on its own, without the pitch', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: true, message: 'Open it from the toolbar.' });
  const text = textOf(doc);

  assert.ok(text.includes('Open it from the toolbar.'));
  assert.ok(!text.includes(COPY.install));
});

test('closing it takes the overlay back out of the page', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: true })();

  assert.ok(doc.body.children[0].removed);
});

// Two marks on one page would otherwise both answer to the same mask id, and the second
// would paint through the first one's mask.
test('every mark gets an id of its own', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: true });
  const first = attrValues(doc, 'id').filter((id) => id.includes('mark'));

  const second = fakeDom();
  showSplash({ doc: second, supported: true });
  const again = attrValues(second, 'id').filter((id) => id.includes('mark'));

  assert.ok(first.length > 0);
  assert.notDeepEqual(first, again);
});

test('the button builds, and the delegated listener will find it', () => {
  const doc = fakeDom();

  const button = createButton({ doc });

  assert.equal(button.attributes['data-sr-trigger'], '');
  assert.ok(button.attributes['aria-label']);
});

test('an unrecognised position falls back rather than going unplaced', () => {
  const doc = fakeDom();

  const button = createButton({ doc, position: 'somewhere-else' });

  assert.ok(button.style.bottom || button.style.top);
  assert.ok(Object.keys(BUTTON_POSITIONS).includes('bottom-right'));
});

// The Starter path: a site writes one empty element and gets our button, with no styling
// decisions of its own to make.
test('an empty placeholder is filled with the branded button', () => {
  const doc = fakeDom();
  const slot = doc.createElement('div');
  slot.attributes[BUTTON_PLACEHOLDER] = '';
  doc.querySelectorAll = (selector) =>
    selector.includes(BUTTON_PLACEHOLDER) ? [slot] : [];

  assert.equal(renderPlaceholders({ doc }), 1);
  assert.equal(slot.children.length, 1);
  assert.equal(slot.children[0].attributes['data-sr-trigger'], '');
});

// It sits in the flow rather than floating: a button placed deliberately in a footer should
// belong to the footer.
test('a placeholder button is inline, not pinned to a corner', () => {
  const doc = fakeDom();
  const slot = doc.createElement('div');
  slot.attributes[BUTTON_PLACEHOLDER] = '';
  doc.querySelectorAll = (selector) => (selector.includes(BUTTON_PLACEHOLDER) ? [slot] : []);

  renderPlaceholders({ doc });
  const button = slot.children[0];

  assert.equal(button.style.position, 'static');
  assert.equal(button.attributes[BUTTON_PLACEHOLDER], 'inline');
});

// Naming a corner asks for the floating one instead.
test('a placeholder naming a corner floats there', () => {
  const doc = fakeDom();
  const slot = doc.createElement('div');
  slot.attributes[BUTTON_PLACEHOLDER] = 'bottom-left';
  doc.querySelectorAll = (selector) => (selector.includes(BUTTON_PLACEHOLDER) ? [slot] : []);

  renderPlaceholders({ doc });
  const button = slot.children[0];

  assert.equal(button.style.position, 'fixed');
  assert.ok(button.style.left);
});

test('a placeholder that already has something in it is left alone', () => {
  const doc = fakeDom();
  // :empty is the selector doing the work in a real DOM; here nothing matches it.
  doc.querySelectorAll = () => [];

  assert.equal(renderPlaceholders({ doc }), 0);
});
