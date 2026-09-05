const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../app');
const events = require('../lib/events');
const { includeBearer, authentication } = require('../authentication');
const { BASE_URL } = require('../lib/api');

const COLLECTION = {
  data: [
    {
      id: 'a1b2c3d4-0000-4000-8000-000000000001',
      type: 'replay',
      attributes: {
        share_token: 'tok-one',
        share_url: 'https://session-replay.com/replays/tok-one',
        resolution_status: 'pending',
        created_at: '2026-09-05T10:00:00Z',
        updated_at: '2026-09-05T10:05:00Z'
      },
      relationships: { site: { data: { id: 'site-1', type: 'site' } } }
    },
    {
      id: 'a1b2c3d4-0000-4000-8000-000000000002',
      type: 'replay',
      attributes: {
        share_token: 'tok-two',
        share_url: 'https://session-replay.com/replays/tok-two',
        resolution_status: 'resolved',
        created_at: '2026-09-04T09:00:00Z',
        updated_at: '2026-09-04T09:30:00Z'
      },
      relationships: { site: { data: null } }
    }
  ],
  included: [{ id: 'site-1', type: 'site', attributes: { domain: 'example.com' } }]
};

const recorder = (payload) => {
  const calls = [];

  return {
    calls,
    z: {
      request: async (options) => {
        calls.push(options);

        return { data: payload, status: 200 };
      }
    }
  };
};

test('a test-trigger list asks the reports endpoint for a handful, with their sites', async () => {
  const { z, calls } = recorder(COLLECTION);
  const trigger = app.triggers.report_created;

  await trigger.operation.performList(z, { authData: {} });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${BASE_URL}/api/v1/replays`);
  assert.equal(calls[0].params.include, 'site');
  assert.ok(calls[0].params['page[size]'] > 0);
});

test('a listed report reads like a delivered one', async () => {
  const { z } = recorder(COLLECTION);
  const trigger = app.triggers.report_status_changed;

  const [first, second] = await trigger.operation.performList(z, { authData: {} });

  assert.equal(first.event, events.REPORT_STATUS_CHANGED);
  assert.equal(first.id, COLLECTION.data[0].id);
  assert.equal(first.report.status, 'pending');
  assert.equal(first.report.share_url, 'https://session-replay.com/replays/tok-one');
  assert.equal(first.site.domain, 'example.com');
  assert.equal(second.site, null);
});

test('the list endpoint carries no severity, so it is reported as absent rather than guessed', async () => {
  const { z } = recorder(COLLECTION);

  const [first] = await app.triggers.report_created.operation.performList(z, { authData: {} });

  assert.equal(first.report.severity, null);
});

test('a list body that arrived unparsed is still read', async () => {
  const trigger = app.triggers.report_created;
  const z = { request: async () => ({ content: JSON.stringify(COLLECTION) }) };

  const results = await trigger.operation.performList(z, { authData: {} });

  assert.equal(results.length, 2);
});

test('an empty page of reports is not an error', async () => {
  const { z } = recorder({ data: [] });

  assert.deepEqual(await app.triggers.report_created.operation.performList(z, { authData: {} }), []);
});

test('the connection test asks an endpoint the API token can actually reach', async () => {
  const { z, calls } = recorder({ data: [] });

  await authentication.test(z, { authData: { api_key: 'tok' } });

  assert.equal(calls[0].url, `${BASE_URL}/api/v1/sites`);
});

test('the connection is labelled with the first domain it can see', () => {
  const listed = { data: [{ id: 'site-1', type: 'site', attributes: { domain: 'example.com' } }] };

  assert.equal(authentication.connectionLabel({}, { inputData: listed }), 'example.com');
  assert.equal(authentication.connectionLabel({}, { inputData: { data: [] } }), 'Session Replay');
  assert.equal(authentication.connectionLabel({}, { inputData: {} }), 'Session Replay');
});

test('every outgoing request carries the API token as a bearer', () => {
  const request = includeBearer({ url: 'https://example.com' }, {}, { authData: { api_key: 'sr_token' } });

  assert.equal(request.headers.Authorization, 'Bearer sr_token');
});

test('a request made before the token is entered is left alone', () => {
  const request = includeBearer({ url: 'https://example.com', headers: { A: 'b' } }, {}, { authData: {} });

  assert.deepEqual(request.headers, { A: 'b' });
});

test('the signing key is optional and the API token is not', () => {
  const byKey = Object.fromEntries(authentication.fields.map((field) => [field.key, field]));

  assert.equal(byKey.api_key.required, true);
  assert.equal(byKey.api_key.type, 'password');
  assert.equal(byKey.signing_key.required, false);
  assert.equal(byKey.signing_key.type, 'password');
});
