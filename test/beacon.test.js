import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { init, TRIGGER_ATTRIBUTE } from '../src/index.js';
import { mountButton } from '../src/button.js';
import {
  BEACON_ENDPOINT,
  LIBRARY_VERSION,
  PRESSED_EVENT,
  SHOWN_EVENT,
  recordEvent,
  resetBeacon
} from '../src/beacon.js';
import { fakeDom } from './dom.js';

const noop = () => {};

function fakeNavigator() {
  const sent = [];

  return {
    sent,
    sendBeacon(url, body) {
      sent.push({ url, body });
      return true;
    }
  };
}

function fakeDocument({ triggers = 1 } = {}) {
  const listeners = [];

  return {
    listeners,
    querySelectorAll: (selector) =>
      selector === `[${TRIGGER_ATTRIBUTE}]` ? new Array(triggers).fill({}) : [],
    addEventListener(type, fn, capture) {
      listeners.push({ type, fn, capture });
    },
    click(target) {
      const event = { target, preventDefault() {} };

      listeners.filter(({ type }) => type === 'click').forEach(({ fn }) => fn(event));
    }
  };
}

const insideTrigger = () => ({
  closest: (selector) => (selector === `[${TRIGGER_ATTRIBUTE}]` ? {} : null)
});

beforeEach(() => resetBeacon());
afterEach(() => resetBeacon());

test('a page that did not ask for the beacon sends nothing', () => {
  const doc = fakeDocument();
  const nav = fakeNavigator();

  init({ doc, nav, onTrigger: noop });
  doc.click(insideTrigger());

  assert.deepEqual(nav.sent, []);
});

test('a page that asked for it reports the button being shown', () => {
  const doc = fakeDocument();
  const nav = fakeNavigator();

  init({ doc, nav, beacon: true, onTrigger: noop });

  assert.equal(nav.sent.length, 1);
  assert.equal(nav.sent[0].url, BEACON_ENDPOINT);
  assert.deepEqual(JSON.parse(nav.sent[0].body), {
    event: SHOWN_EVENT,
    version: LIBRARY_VERSION
  });
});

test('a page with no trigger on it reports nothing shown', () => {
  const doc = fakeDocument({ triggers: 0 });
  const nav = fakeNavigator();

  init({ doc, nav, beacon: true, onTrigger: noop });

  assert.deepEqual(nav.sent, []);
});

test('a press is reported, and carries the same two fields', () => {
  const doc = fakeDocument({ triggers: 0 });
  const nav = fakeNavigator();

  init({ doc, nav, beacon: true, onTrigger: noop });
  doc.click(insideTrigger());

  assert.equal(nav.sent.length, 1);
  assert.deepEqual(JSON.parse(nav.sent[0].body), {
    event: PRESSED_EVENT,
    version: LIBRARY_VERSION
  });
});

test('every press is counted, while the button is only shown once', () => {
  const doc = fakeDocument();
  const nav = fakeNavigator();

  init({ doc, nav, beacon: true, onTrigger: noop });
  init({ doc, nav, beacon: true, onTrigger: noop });
  doc.click(insideTrigger());
  doc.click(insideTrigger());

  const events = nav.sent.map(({ body }) => JSON.parse(body).event);

  assert.deepEqual(events, [SHOWN_EVENT, PRESSED_EVENT, PRESSED_EVENT]);
});

test('a bare init followed by one that asks for the beacon counts the button once', () => {
  const doc = fakeDocument();
  const nav = fakeNavigator();

  init({ doc, nav, onTrigger: noop });
  init({ doc, nav, beacon: true, onTrigger: noop });
  doc.click(insideTrigger());
  doc.click(insideTrigger());

  const events = nav.sent.map(({ body }) => JSON.parse(body).event);

  assert.deepEqual(events, [SHOWN_EVENT, PRESSED_EVENT, PRESSED_EVENT]);
});

test('a button this library mounts reports itself as shown', () => {
  const doc = fakeDom();
  const nav = fakeNavigator();

  init({ doc, nav, beacon: true, onTrigger: noop });
  assert.deepEqual(nav.sent, []);

  mountButton({ doc, nav });

  assert.equal(nav.sent.length, 1);
  assert.deepEqual(JSON.parse(nav.sent[0].body), {
    event: SHOWN_EVENT,
    version: LIBRARY_VERSION
  });
});

test('mounting a button after init already counted one does not count a second', () => {
  const doc = fakeDom();
  const nav = fakeNavigator();

  doc.querySelectorAll = (selector) =>
    selector === `[${TRIGGER_ATTRIBUTE}]` ? [{}] : [];

  init({ doc, nav, beacon: true, onTrigger: noop });
  assert.equal(nav.sent.length, 1);

  mountButton({ doc, nav });

  assert.equal(nav.sent.length, 1);
});

test('the body carries nothing about the page or the visitor', () => {
  const nav = fakeNavigator();

  recordEvent(SHOWN_EVENT, { nav });
  assert.deepEqual(nav.sent, []);

  init({ doc: fakeDocument(), nav, beacon: true, onTrigger: noop });

  const body = JSON.parse(nav.sent[0].body);

  assert.deepEqual(Object.keys(body).sort(), ['event', 'version']);
});

test('a browser without sendBeacon is not asked to do anything else', () => {
  const doc = fakeDocument();

  assert.doesNotThrow(() => init({ doc, nav: {}, beacon: true, onTrigger: noop }));
});

test('the version it reports is the version this package ships', async () => {
  const { version } = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  );

  assert.equal(LIBRARY_VERSION, version);
});
