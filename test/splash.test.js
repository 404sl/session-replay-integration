import test from 'node:test';
import assert from 'node:assert/strict';

import { showSplash, STORE_URL, SITE_URL } from '../src/splash.js';
import { copyFor, pageLanguage } from '../src/copy.js';

// The overlay resolves its words from the page; the tests read the same source.
const COPY = copyFor({ doc: { documentElement: { getAttribute: () => 'en' } } });
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
  documentElement.attributes.lang = 'en';

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
// The builders assign href as a property rather than an attribute, which is why this does
// not go through attrValues - an assertion there would pass on an empty list and prove
// nothing.
const hrefs = (doc) => doc.created.map((node) => node.href).filter(Boolean);

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

// Being told to go and find another browser is a bigger ask than pressing "add to Chrome",
// so this reader needs the argument at least as much as the one who can install it.
test('it still makes the case where it cannot be installed', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: false });
  const text = textOf(doc);

  COPY.captures.forEach((line) => assert.ok(text.includes(line), `missing: ${line}`));
  assert.ok(text.includes(COPY.free));
  // The offer that solves their immediate problem keeps its place.
  assert.ok(text.includes(COPY.unsupportedNext));
  assert.ok(text.includes(COPY.copy));
});

// The Web Store cannot help a browser that cannot install from it; the site can.
test('it points at the site, not the store, where the store is useless', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: false });

  assert.ok(hrefs(doc).includes(SITE_URL));
  assert.ok(!hrefs(doc).includes(STORE_URL));
});

// Both of these readers already have the extension. Telling them it is free and needs no
// account is telling them what they know.
['blocked', 'no-toolbar'].forEach((variant) => {
  test(`it makes no pitch in the ${variant} state`, () => {
    const doc = fakeDom();

    showSplash({ doc, supported: true, variant });
    const text = textOf(doc);

    assert.ok(!text.includes(COPY.free));
    COPY.captures.forEach((line) => assert.ok(!text.includes(line), `unexpected: ${line}`));
    assert.ok(!hrefs(doc).includes(SITE_URL));
  });
});

test('it shows a caller message on its own, without the pitch', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: true, message: 'Open it from the toolbar.' });
  const text = textOf(doc);

  assert.ok(text.includes('Open it from the toolbar.'));
  assert.ok(!text.includes(COPY.install));
});

// The panel-blocked state, in a window that has the toolbar it points at.
test('it points at the toolbar when there is one', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: true, variant: 'blocked' });
  const text = textOf(doc);

  assert.ok(text.includes(COPY.blockedTitle));
  assert.ok(text.includes(COPY.panelBlocked));
  assert.ok(!text.includes(COPY.install));
});

// In an app window the toolbar does not exist, so the only way on is to carry the page to
// a browser tab - the same offer the unsupported state makes, for the same reason.
test('it offers the link instead of a toolbar that is not there', () => {
  const doc = fakeDom();

  showSplash({ doc, supported: true, variant: 'no-toolbar' });
  const text = textOf(doc);

  assert.ok(text.includes(COPY.noToolbarTitle));
  assert.ok(text.includes(COPY.noToolbar));
  assert.ok(text.includes(COPY.noToolbarNext));
  assert.ok(text.includes('https://example.com/checkout'));
  assert.ok(text.includes(COPY.copy));
  // It is already installed; there is nothing to add.
  assert.ok(!text.includes(COPY.install));
  assert.ok(!text.includes(COPY.blockedTitle));
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

// Walks a stub subtree, since the wrapper now has descendants worth asserting about.
function descendants(node, found = []) {
  (node.children || []).forEach((child) => {
    found.push(child);
    descendants(child, found);
  });

  return found;
}

const triggerIn = (root) =>
  descendants(root).find((node) => node.attributes?.['data-sr-trigger'] !== undefined);

const linkIn = (root) => descendants(root).find((node) => node.nodeName === 'A');

test('the button builds, and the delegated listener will find it', () => {
  const doc = fakeDom();

  const root = createButton({ doc });
  const trigger = triggerIn(root);

  assert.ok(trigger, 'no element carries the trigger attribute');
  assert.equal(trigger.attributes['data-sr-trigger'], '');
  assert.ok(trigger.attributes['aria-label']);
});

test('it credits us, with a link somebody can follow', () => {
  const doc = fakeDom();

  const link = linkIn(createButton({ doc }));

  assert.ok(link, 'no attribution link');
  assert.match(link.href, /^https:\/\/session-replay\.com\//);
  assert.match(link.href, /utm_source=integration/);
  assert.equal(link.textContent, 'Session Replay');
  // target="_blank" without noopener hands the opened page a handle on the window it came
  // from, and that window belongs to a customer of ours.
  assert.equal(link.rel, 'noopener');
});

// An <a> inside a <button> is interactive content nested in interactive content: the spec
// forbids it, and where browsers disagree it is the link that loses. This is the assertion
// that keeps the two as siblings if anybody ever tidies the markup.
test('the link is never inside the button', () => {
  const doc = fakeDom();

  const root = createButton({ doc });
  const trigger = triggerIn(root);

  assert.equal(linkIn(trigger), undefined);
  assert.ok(linkIn(root), 'the link should still be in the wrapper');
});

test('attribution can be turned off, and then the button is the whole thing', () => {
  const doc = fakeDom();

  const button = createButton({ doc, attribution: false });

  assert.equal(button.attributes['data-sr-trigger'], '');
  assert.equal(linkIn(button), undefined);
  // The handle moves back onto the button, or nothing could find or remove it.
  assert.equal(button.attributes['data-session-replay-button'], 'bottom-right');
});

// Under a circle, a line reading "Powered by Session Replay" is wider than the thing it
// credits.
test('the credit goes away when the button shrinks to a circle', () => {
  const doc = fakeDom();

  const root = createButton({ doc, compact: true });
  const credit = descendants(root).find((node) => node.nodeName === 'SMALL');

  assert.equal(credit.style.display, 'none');
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
  assert.ok(triggerIn(slot), 'the filled placeholder has no trigger in it');
  assert.ok(linkIn(slot), 'the filled placeholder has no attribution in it');
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

// The markup-only way to say it, for a plan that has paid to drop the credit. Without this
// the only way out is the JavaScript call the one-element install exists to avoid.
test('a placeholder can decline the credit in markup', () => {
  const doc = fakeDom();
  const slot = doc.createElement('div');
  slot.attributes[BUTTON_PLACEHOLDER] = '';
  slot.attributes['data-attribution'] = 'false';
  doc.querySelectorAll = (selector) => (selector.includes(BUTTON_PLACEHOLDER) ? [slot] : []);

  renderPlaceholders({ doc });

  assert.ok(triggerIn(slot), 'still needs a trigger');
  assert.equal(linkIn(slot), undefined, 'the credit should be gone');
});

test('a placeholder that already has something in it is left alone', () => {
  const doc = fakeDom();
  // :empty is the selector doing the work in a real DOM; here nothing matches it.
  doc.querySelectorAll = () => [];

  assert.equal(renderPlaceholders({ doc }), 0);
});

// An English overlay on a Russian page announces that it was not written for the person
// reading it, which is a poor way to ask somebody to install software.
test('speaks the language the page says it is in', () => {
  const doc = fakeDom();
  doc.documentElement.attributes.lang = 'ru';

  showSplash({ doc, supported: true });

  assert.ok(textOf(doc).includes(copyFor({ lang: 'ru' }).install));
});

test('falls back to English for a language we do not have', () => {
  const doc = fakeDom();
  doc.documentElement.attributes.lang = 'ja';

  showSplash({ doc, supported: true });

  assert.ok(textOf(doc).includes('Add to Chrome'));
});

// pt-BR is answered in Portuguese, which is the better of the two wrong answers available.
test('reads a region-tagged language as its base', () => {
  assert.equal(pageLanguage({ documentElement: { getAttribute: () => 'pt-BR' } }), 'pt');
  assert.equal(copyFor({ lang: 'pt-BR' }).install, 'Adicionar ao Chrome');
});

// A page that says nothing gets English rather than nothing.
test('survives a page that declares no language', () => {
  assert.equal(pageLanguage({ documentElement: { getAttribute: () => null } }), '');
  assert.equal(copyFor({ lang: '' }).install, 'Add to Chrome');
});
