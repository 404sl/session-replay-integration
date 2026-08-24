import test from 'node:test';
import assert from 'node:assert/strict';

import {
  answerContextRequests,
  clearContext,
  getContext,
  identify,
  CONTEXT_EVENT,
  CONTEXT_REQUEST_EVENT
} from '../src/identify.js';

// The same shape of fake as detect.test.js uses, kept apart from it because what matters
// here is what was dispatched rather than what answered. No jsdom: the package has no
// dependencies, which matters more than usual for something sites put on their pages.
function fakeWindow() {
  const listeners = new Map();
  const dispatched = [];

  return {
    listeners,
    dispatched,
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
      dispatched.push(event);
      (listeners.get(event.type) || []).forEach((fn) => fn(event));
    },
    // Stands in for the extension's content script asking the page who this is.
    ask() {
      this.dispatchEvent(new this.CustomEvent(CONTEXT_REQUEST_EVENT));

      return dispatched.filter(({ type }) => type === CONTEXT_EVENT).pop()?.detail?.context;
    }
  };
}

test('holds what a site hands over, under the name it is stored by', () => {
  clearContext();

  const context = identify(
    {
      email: 'ada@example.com',
      plan: 'professional',
      orderId: 'SR-1201',
      release: '2026.08.18',
      requestId: 'b1f4c0'
    },
    { win: fakeWindow() }
  );

  assert.deepEqual(context, {
    email: 'ada@example.com',
    plan: 'professional',
    order_id: 'SR-1201',
    release: '2026.08.18',
    request_id: 'b1f4c0'
  });
});

// The keys are the site's to pick, the same as the sr-data- meta tags they sit beside. A
// fixed list here would have meant that one of the two ways to send something could send it.
test('keeps a key the library has never heard of', () => {
  clearContext();

  identify({ email: 'ada@example.com', warehouse: 'leeds-2', basketSize: 3 }, { win: fakeWindow() });

  assert.deepEqual(getContext(), { email: 'ada@example.com', warehouse: 'leeds-2', basket_size: '3' });
});

// One field, however the page spells it, and under the name the extension already files a
// pushed key by - so the call and the row it becomes on the report say the same word.
test('camelCase, kebab and underscore are one key', () => {
  clearContext();
  const win = fakeWindow();

  identify({ orderId: 'SR-1201' }, { win });
  identify({ 'order-id': 'SR-1202' }, { win });
  identify({ order_id: 'SR-1203' }, { win });

  assert.deepEqual(getContext(), { order_id: 'SR-1203' });
});

test('drops a value with a shape to it rather than storing a blob', () => {
  clearContext();

  identify({ plan: { name: 'professional' }, release: ['2026.08.18'], basket: [1, 2] }, { win: fakeWindow() });

  assert.deepEqual(getContext(), {});
});

// The server's own numbers, kept here as politeness rather than as the authority.
test('holds twenty keys, and still corrects one it already has', () => {
  clearContext();
  const win = fakeWindow();

  for (let index = 0; index < 25; index += 1) identify({ [`key${index}`]: String(index) }, { win });

  assert.equal(Object.keys(getContext()).length, 20);
  assert.equal(getContext().key19, '19');
  assert.equal(getContext().key20, undefined);

  identify({ key0: 'corrected' }, { win });

  assert.equal(getContext().key0, 'corrected');
  assert.equal(Object.keys(getContext()).length, 20);
});

test('trims a key to 64 characters and a value to 1024', () => {
  clearContext();

  identify({ ['a'.repeat(90)]: 'b'.repeat(2000) }, { win: fakeWindow() });

  const [name] = Object.keys(getContext());

  assert.equal(name, 'a'.repeat(64));
  assert.equal(getContext()[name].length, 1024);
});

// An SPA learns who somebody is on sign-in and which release it is running at boot. Neither
// call should forget the other.
test('repeat calls merge rather than replace', () => {
  clearContext();
  const win = fakeWindow();

  identify({ release: '2026.08.18' }, { win });
  identify({ email: 'ada@example.com' }, { win });
  identify({ email: 'grace@example.com' }, { win });

  assert.deepEqual(getContext(), { release: '2026.08.18', email: 'grace@example.com' });
});

test('a null drops a key, for a sign-out', () => {
  clearContext();
  const win = fakeWindow();

  identify({ email: 'ada@example.com', plan: 'professional' }, { win });
  identify({ email: null }, { win });

  assert.deepEqual(getContext(), { plan: 'professional' });
});

// The delete has to find the stored name too, or a sign-out spelled the other way silently
// leaves the value on the page.
test('a null drops the key however it is spelled', () => {
  clearContext();
  const win = fakeWindow();

  identify({ orderId: 'SR-1201' }, { win });
  identify({ 'order-id': null }, { win });

  assert.deepEqual(getContext(), {});
});

test('hands back a copy, so a caller holding it cannot edit ours', () => {
  clearContext();

  const context = identify({ plan: 'starter' }, { win: fakeWindow() });
  context.plan = 'professional';

  assert.deepEqual(getContext(), { plan: 'starter' });
});

test('answers the extension when it asks, with what was pushed', () => {
  clearContext();
  const win = fakeWindow();

  identify({ email: 'ada@example.com', requestId: 'b1f4c0' }, { win });

  assert.deepEqual(win.ask(), { email: 'ada@example.com', request_id: 'b1f4c0' });
});

// Nothing has been handed over, so there is nothing to answer with - and an empty answer
// would be a different thing to say than saying nothing.
test('says nothing until a site has identified somebody', () => {
  clearContext();
  const win = fakeWindow();

  assert.equal(win.ask(), undefined);
});

test('answers once however many times a page identifies', () => {
  clearContext();
  const win = fakeWindow();

  identify({ email: 'ada@example.com' }, { win });
  identify({ plan: 'starter' }, { win });
  identify({ release: '2026.08.18' }, { win });

  win.ask();

  assert.equal(win.dispatched.filter(({ type }) => type === CONTEXT_EVENT).length, 1);
});

test('reports whether it was the call that started listening', () => {
  const win = fakeWindow();

  assert.equal(answerContextRequests({ win }), true);
  assert.equal(answerContextRequests({ win }), false);
});
