import test from 'node:test';
import assert from 'node:assert/strict';

import { report } from '../src/index.js';
import { copyFor } from '../src/copy.js';
import { OPEN_EVENT, OPENED_EVENT, PING_EVENT, PONG_EVENT } from '../src/detect.js';

const COPY = copyFor({ lang: 'en' });

// Enough of a document to run the overlay builders end to end, and enough of a window for
// the two handshakes report() makes before it draws anything. Same reasoning as everywhere
// else here: jsdom would be the first dependency this package has ever had.
function fakeDom({ appWindow = false, answer = null } = {}) {
  const created = [];

  const makeNode = (name) => {
    const node = {
      nodeName: name,
      style: {},
      children: [],
      attributes: {},
      listeners: {},
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
      insertBefore(child) {
        node.children.unshift(child);
        return child;
      },
      remove() {},
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

  const listeners = new Map();
  const warnings = [];
  const asked = [];

  const win = {
    created,
    warnings,
    // Every capture kind the page sent, in order, so a test can prove the choice travelled.
    asked,
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
    // Stands in for the content script: it is there, and unless a test says otherwise
    // Chrome refuses to open the panel.
    dispatchEvent(event) {
      const reply = (type, detail) => (listeners.get(type) || []).forEach((fn) => fn({ detail }));

      if (event.type === PING_EVENT) reply(PONG_EVENT, { version: '1.2.0' });
      if (event.type === OPEN_EVENT) {
        asked.push(event.detail?.capture);
        reply(OPENED_EVENT, answer || { opened: false, reason: 'sidePanel.open() rejected' });
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
    querySelector: () => null,
    contains: () => true,
    addEventListener() {},
    removeEventListener() {},
    defaultView: win
  };

  return win;
}

const textOf = (win) => win.created.map((node) => node.textContent || '').join(' ');

const within = (node) => [node.textContent || '', ...(node.children || []).map(within)].join(' ');

// The chooser's rows carry their label in a child span, so they are found the way somebody
// using the dialog finds them: by the words on them.
const rowSaying = (win, label) =>
  win.created.find(
    (node) =>
      node.nodeName === 'BUTTON' && node.listeners?.click?.length && within(node).includes(label)
  );

const buttonSaying = (win, label) =>
  win.created.find((node) => node.nodeName === 'BUTTON' && node.textContent === label);

const press = (node) => (node.listeners.click || []).forEach((fn) => fn());

// report() now settles on what the visitor does with the chooser, so the pending promise is
// handed back wrapped: returning it bare would have the await here wait for a press nobody
// has made yet.
async function drawChooser(win) {
  const outcome = report({ win, doc: win.document });

  // The chooser is built after the detection handshake, which settles in microtasks.
  await new Promise((resolve) => setImmediate(resolve));

  return { outcome };
}

test('the chooser offers what the extension accepts, and no tab recording', async () => {
  const win = fakeDom({ answer: { opened: true } });
  const { outcome } = await drawChooser(win);

  const text = textOf(win);

  assert.ok(text.includes(COPY.chooseTitle));
  assert.ok(rowSaying(win, COPY.captureShot));
  assert.ok(rowSaying(win, COPY.captureFull));
  assert.ok(rowSaying(win, COPY.captureScreen));

  // A tab recording is refused by the extension when a page asks for it, so it is explained
  // rather than offered: a row that could only answer with an apology is the do-nothing
  // button this whole path exists to remove.
  assert.ok(text.includes(COPY.captureTabNote));
  assert.equal(rowSaying(win, COPY.captureTabNote), undefined);

  press(rowSaying(win, COPY.captureShot));
  await outcome;
});

// The whole point of the chooser: the kind somebody picked is the kind the extension is
// asked for. A row sending the wrong string fails as a silent refusal, not as an error.
test('the chosen capture is what gets sent', async () => {
  const win = fakeDom({ answer: { opened: true } });
  const { outcome } = await drawChooser(win);

  press(rowSaying(win, COPY.captureFull));

  assert.equal(await outcome, 'opened');
  assert.deepEqual(win.asked, ['screenshot_full_page']);
});

test('a screen recording is asked for by its own name', async () => {
  const win = fakeDom({ answer: { opened: true } });
  const { outcome } = await drawChooser(win);

  press(rowSaying(win, COPY.captureScreen));

  assert.equal(await outcome, 'opened');
  assert.deepEqual(win.asked, ['video_screen']);
});

// Changing your mind arms nothing and opens nothing. It is also not 'blocked': that value
// means the extension refused, and a site branching on it should not see this instead.
test('dismissing the chooser opens nothing and says so', async () => {
  const win = fakeDom({ answer: { opened: true } });
  const { outcome } = await drawChooser(win);

  press(buttonSaying(win, COPY.dismiss));

  assert.equal(await outcome, 'dismissed');
  assert.deepEqual(win.asked, []);
});

// The bug: an installed PWA has no extension toolbar, so the toolbar advice asks somebody
// to press a button their window does not have.
test('a window with no toolbar is not told to open one', async () => {
  const win = fakeDom({ appWindow: true });
  const { outcome } = await drawChooser(win);

  press(rowSaying(win, COPY.captureShot));

  assert.equal(await outcome, 'blocked');

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
  const { outcome } = await drawChooser(win);

  press(rowSaying(win, COPY.captureShot));

  assert.equal(await outcome, 'blocked');

  const text = textOf(win);

  assert.ok(text.includes(COPY.blockedTitle));
  assert.ok(text.includes(COPY.panelBlocked));
  assert.ok(!text.includes(COPY.noToolbarTitle));
});

// Whoever is integrating needs to know which rule Chrome hit, and the console is where
// they look for it.
test('the reason the panel refused reaches the console', async () => {
  const win = fakeDom();
  const { outcome } = await drawChooser(win);

  press(rowSaying(win, COPY.captureShot));
  await outcome;

  assert.ok(win.warnings.some((line) => line.includes('sidePanel.open() rejected')));
});
