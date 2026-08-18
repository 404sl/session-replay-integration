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

test('holds the five keys a site can hand over', () => {
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
    orderId: 'SR-1201',
    release: '2026.08.18',
    requestId: 'b1f4c0'
  });
});

// data-custom was the meta tag's escape hatch and the reason it could not be shown on a
// report. Anything outside the vocabulary is dropped rather than carried.
test('ignores anything that is not one of them', () => {
  clearContext();

  identify({ email: 'ada@example.com', ssn: '000-00-0000', custom: { basket: [1, 2] } }, { win: fakeWindow() });

  assert.deepEqual(getContext(), { email: 'ada@example.com' });
});

test('drops a value with a shape to it rather than storing a blob', () => {
  clearContext();

  identify({ plan: { name: 'professional' }, release: ['2026.08.18'] }, { win: fakeWindow() });

  assert.deepEqual(getContext(), {});
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

  assert.deepEqual(win.ask(), { email: 'ada@example.com', requestId: 'b1f4c0' });
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
