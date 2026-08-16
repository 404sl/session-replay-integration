import test from 'node:test';
import assert from 'node:assert/strict';

import { detectExtension, isSupportedBrowser, PING_EVENT, PONG_EVENT } from '../src/detect.js';

// A window with just enough of one to answer questions about events. No jsdom: the parts
// worth testing are the decisions, and a fake here keeps the package dependency-free -
// which matters more than usual for something sites are asked to put on their pages.
function fakeWindow({ answers = null } = {}) {
  const listeners = new Map();

  return {
    listeners,
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
    dispatchEvent(event) {
      // Stands in for the content script: answers the ping synchronously, the way a
      // listener in the page's own realm does.
      if (event.type === PING_EVENT && answers) {
        (listeners.get(PONG_EVENT) || []).forEach((fn) => fn({ detail: answers }));
      }
    },
    setTimeout(fn, ms) {
      return globalThis.setTimeout(fn, ms);
    }
  };
}

test('finds the extension when something answers', async () => {
  const win = fakeWindow({ answers: { version: '1.2.0' } });

  assert.deepEqual(await detectExtension({ win, timeoutMs: 10 }), { version: '1.2.0' });
});

test('gives up when nothing answers, rather than waiting on a button press', async () => {
  const win = fakeWindow();

  assert.equal(await detectExtension({ win, timeoutMs: 10 }), null);
});

test('stops listening once it has an answer', async () => {
  const win = fakeWindow({ answers: {} });

  await detectExtension({ win, timeoutMs: 10 });

  assert.equal((win.listeners.get(PONG_EVENT) || []).length, 0);
});

test('a late answer cannot resolve it twice', async () => {
  const win = fakeWindow();
  const result = detectExtension({ win, timeoutMs: 5 });

  await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
  (win.listeners.get(PONG_EVENT) || []).forEach((fn) => fn({ detail: { late: true } }));

  assert.equal(await result, null);
});

test('recognises the browsers that can run a Chrome extension', () => {
  const brands = (...names) => ({ userAgentData: { brands: names.map((brand) => ({ brand })) } });

  assert.equal(isSupportedBrowser({ nav: brands('Chromium', 'Google Chrome') }), true);
  assert.equal(isSupportedBrowser({ nav: brands('Microsoft Edge', 'Chromium') }), true);
  assert.equal(isSupportedBrowser({ nav: brands('Not A;Brand') }), false);
});

// Safari and Firefox never expose userAgentData, so without this they would read as
// "no brands, so maybe".
test('falls back to the user agent where there are no brands', () => {
  const ua = (userAgent) => ({ userAgent });

  assert.equal(isSupportedBrowser({ nav: ua('Mozilla/5.0 ... Chrome/151.0.0.0 Safari/537.36') }), true);
  assert.equal(isSupportedBrowser({ nav: ua('Mozilla/5.0 ... Version/17.0 Safari/605.1.15') }), false);
  assert.equal(isSupportedBrowser({ nav: ua('Mozilla/5.0 ... Firefox/130.0') }), false);
});
