const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const app = require('../app');
const events = require('../lib/events');
const signature = require('../lib/signature');
const report = require('../lib/report');
const hook = require('../lib/hook');
const { payloadFor, sampleFor, DELIVERY_ID } = require('../lib/samples');

const SECRET = 'whsec_a-destination-signing-key';

const delivery = (payload, { secret = null, deliveryId = DELIVERY_ID } = {}) => {
  const content = JSON.stringify(payload);
  const seconds = Math.floor(Date.now() / 1000);
  const headers = { 'X-Session-Replay-Event': payload.event };

  if (deliveryId) headers['X-Session-Replay-Delivery'] = deliveryId;

  if (secret) {
    const digest = crypto.createHmac('sha256', secret).update(`${seconds}.${content}`).digest('hex');

    headers['X-Session-Replay-Signature'] = `t=${seconds},v1=${digest}`;
  }

  return { cleanedRequest: payload, rawRequest: { content, headers }, inputData: {} };
};

const hooks = () => Object.values(app.triggers).filter((trigger) => trigger.operation.type === 'hook');

const keyed = (event) => hooks().find((trigger) => trigger.operation.sample.event === event);

test('every event the app emits has a trigger', () => {
  assert.deepEqual(
    hooks().map((trigger) => trigger.key).sort(),
    ['report_created', 'report_first_viewed', 'report_sent', 'report_severity_changed', 'report_status_changed']
  );

  events.ALL.forEach((event) => assert.ok(keyed(event), `no trigger fires on ${event}`));
});

test('a trigger turns its own delivery into one flattened report', async () => {
  const payload = payloadFor(events.REPORT_CREATED);
  const trigger = keyed(events.REPORT_CREATED);

  const results = await trigger.operation.perform({}, delivery(payload));

  assert.equal(results.length, 1);
  assert.equal(results[0].id, DELIVERY_ID);
  assert.equal(results[0].event, events.REPORT_CREATED);
  assert.equal(results[0].version, events.PAYLOAD_VERSION);
  assert.equal(results[0].report.share_url, payload.data.report.share_url);
  assert.equal(results[0].report.status, payload.data.report.status);
  assert.equal(results[0].site.domain, 'example.com');
});

test('a trigger ignores a delivery for one of the other events', async () => {
  const trigger = keyed(events.REPORT_CREATED);

  const results = await trigger.operation.perform({}, delivery(payloadFor(events.REPORT_STATUS_CHANGED)));

  assert.deepEqual(results, []);
});

test('the delivery id is the deduplication key, so two changes to one report both fire', async () => {
  const trigger = keyed(events.REPORT_STATUS_CHANGED);
  const payload = payloadFor(events.REPORT_STATUS_CHANGED);

  const first = await trigger.operation.perform({}, delivery(payload, { deliveryId: 'delivery-one' }));
  const second = await trigger.operation.perform({}, delivery(payload, { deliveryId: 'delivery-two' }));

  assert.equal(first[0].report.id, second[0].report.id);
  assert.notEqual(first[0].id, second[0].id);
});

test('a retry of one delivery keeps its id, so Zapier sees it once', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  const first = await trigger.operation.perform({}, delivery(payload));
  const retried = await trigger.operation.perform({}, delivery(payload));

  assert.equal(first[0].id, retried[0].id);
});

test('without the delivery header two changes to one report still fire twice', async () => {
  const trigger = keyed(events.REPORT_STATUS_CHANGED);
  const earlier = payloadFor(events.REPORT_STATUS_CHANGED);
  const later = { ...earlier, sent_at: '2026-09-05T12:03:11Z' };

  const first = await trigger.operation.perform({}, delivery(earlier, { deliveryId: null }));
  const second = await trigger.operation.perform({}, delivery(later, { deliveryId: null }));

  assert.equal(first[0].report.id, second[0].report.id);
  assert.notEqual(first[0].id, second[0].id);
});

test('without the delivery header a retry of one delivery still fires once', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  const first = await trigger.operation.perform({}, delivery(payload, { deliveryId: null }));
  const retried = await trigger.operation.perform({}, delivery(payload, { deliveryId: null }));

  assert.equal(first[0].id, retried[0].id);
});

test('a delivery carrying neither a delivery header nor a sent_at is refused', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  delete payload.sent_at;

  await assert.rejects(
    async () => trigger.operation.perform({}, delivery(payload, { deliveryId: null })),
    report.UnidentifiedDelivery
  );
});

test('the signature is checked when the Zap carries a signing key', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  const signed = delivery(payload, { secret: SECRET });
  signed.inputData = { signing_key: SECRET };

  const results = await trigger.operation.perform({}, signed);

  assert.equal(results.length, 1);
});

test('a forged delivery is refused when the Zap carries a signing key', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  const forged = delivery(payload, { secret: 'not-the-signing-key' });
  forged.inputData = { signing_key: SECRET };

  await assert.rejects(
    async () => trigger.operation.perform({}, forged),
    signature.InvalidSignature
  );
});

test('an unsigned delivery is refused when the Zap carries a signing key', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const unsigned = delivery(payloadFor(events.REPORT_CREATED));
  unsigned.inputData = { signing_key: SECRET };

  await assert.rejects(
    async () => trigger.operation.perform({}, unsigned),
    signature.InvalidSignature
  );
});

test('a key on one Zap is not read from another, because it lives on the trigger', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  const signed = delivery(payload, { secret: SECRET });
  signed.inputData = { signing_key: 'the-other-destinations-key' };

  await assert.rejects(
    async () => trigger.operation.perform({}, signed),
    signature.InvalidSignature
  );
});

test('an unsigned delivery is accepted when no signing key was given', async () => {
  const trigger = keyed(events.REPORT_CREATED);

  const results = await trigger.operation.perform({}, delivery(payloadFor(events.REPORT_CREATED)));

  assert.equal(results.length, 1);
});

test('every trigger asks for its own signing key rather than a shared one', () => {
  hooks().forEach((trigger) => {
    const byKey = Object.fromEntries(trigger.operation.inputFields.map((field) => [field.key, field]));

    assert.equal(byKey.signing_key.required, false);
    assert.equal(byKey.signing_key.type, 'password');
    assert.match(byKey.signing_key.helpText, /each Zap has its own/);
  });
});

test('the test-trigger step answers with the sample, so it needs no API call', async () => {
  for (const trigger of hooks()) {
    const listed = await trigger.operation.performList({}, { inputData: {} });

    assert.deepEqual(listed, [sampleFor(trigger.operation.sample.event)]);
  }
});

test('every trigger ships a sample shaped like what perform returns', async () => {
  for (const trigger of hooks()) {
    const { sample } = trigger.operation;
    const [live] = await trigger.operation.perform({}, delivery(payloadFor(sample.event)));

    assert.deepEqual(Object.keys(sample).sort(), Object.keys(live).sort(), trigger.key);
    assert.deepEqual(Object.keys(sample.report).sort(), Object.keys(live.report).sort(), trigger.key);
    assert.deepEqual(Object.keys(sample.site).sort(), Object.keys(live.site).sort(), trigger.key);
  }
});

test('every output field names something the sample actually carries', () => {
  hooks().forEach((trigger) => {
    const { sample, outputFields } = trigger.operation;

    outputFields.forEach(({ key }) => {
      const [head, tail] = key.split('__');
      const present = tail === undefined ? head in sample : sample[head] !== null && tail in sample[head];

      assert.ok(present, `${trigger.key} advertises ${key}, which is not in its sample`);
    });
  });
});

const TOKEN = 'an-api-token-from-the-settings-screen';
const TARGET_URL = 'https://hooks.zapier.com/hooks/standard/1/abc';

const recorder = (data) => {
  const calls = [];

  return {
    calls,
    z: {
      request: async (options) => {
        calls.push(options);

        return { status: 201, data };
      }
    }
  };
};

const created = (id, secret) => ({
  data: { id, type: 'webhook_destination', attributes: { url: TARGET_URL, events: [], secret } }
});

const refusing = {
  request: async () => {
    throw new Error('a trigger reached the Session Replay API');
  }
};

test('turning a Zap on subscribes its own URL to its own event', async () => {
  const trigger = keyed(events.REPORT_STATUS_CHANGED);
  const { z, calls } = recorder(created('42', 'whsec_handed-back-on-create'));

  const subscription = await trigger.operation.performSubscribe(z, {
    targetUrl: TARGET_URL,
    inputData: { api_token: TOKEN }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, 'https://session-replay.com/api/v1/webhook_destinations');
  assert.equal(calls[0].headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(calls[0].body, { url: TARGET_URL, events: [events.REPORT_STATUS_CHANGED] });
  assert.deepEqual(subscription, { id: '42', secret: 'whsec_handed-back-on-create' });
});

test('turning a Zap off removes the destination it created', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const { z, calls } = recorder({});

  await trigger.operation.performUnsubscribe(z, {
    inputData: { api_token: TOKEN },
    subscribeData: { id: '42', secret: 'whsec_handed-back-on-create' }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].url, 'https://session-replay.com/api/v1/webhook_destinations/42');
  assert.equal(calls[0].headers.Authorization, `Bearer ${TOKEN}`);
});

test('turning a Zap on without an API token fails loudly rather than subscribing to nothing', async () => {
  const trigger = keyed(events.REPORT_CREATED);

  await assert.rejects(
    async () => trigger.operation.performSubscribe(refusing, { targetUrl: TARGET_URL, inputData: {} }),
    (error) => {
      assert.ok(error instanceof hook.MissingApiToken, `subscribing threw ${error.message}`);
      assert.match(error.message, /API token/);
      assert.match(error.message, /session-replay\.com\/app\/settings/);

      return true;
    }
  );
});

test('turning a Zap off without an API token leaves the destination rather than failing', async () => {
  const trigger = keyed(events.REPORT_CREATED);

  const removed = await trigger.operation.performUnsubscribe(refusing, { inputData: {}, subscribeData: {} });

  assert.deepEqual(removed, {});
});

test('a subscription that stored no id is not turned into a DELETE of everything', async () => {
  const trigger = keyed(events.REPORT_CREATED);

  const removed = await trigger.operation.performUnsubscribe(refusing, { inputData: { api_token: TOKEN } });

  assert.deepEqual(removed, {});
});

test('the key handed back on subscribe checks the signature without being pasted', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  const signed = delivery(payload, { secret: SECRET });
  signed.subscribeData = { id: '42', secret: SECRET };

  const results = await trigger.operation.perform({}, signed);

  assert.equal(results.length, 1);

  const forged = delivery(payload, { secret: 'not-the-signing-key' });
  forged.subscribeData = { id: '42', secret: SECRET };

  await assert.rejects(async () => trigger.operation.perform({}, forged), signature.InvalidSignature);
});

test('a pasted signing key wins over the one subscribe stored', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const signed = delivery(payloadFor(events.REPORT_CREATED), { secret: SECRET });

  signed.inputData = { signing_key: SECRET };
  signed.subscribeData = { id: '42', secret: 'the-key-from-a-destination-since-rotated' };

  const results = await trigger.operation.perform({}, signed);

  assert.equal(results.length, 1);
});

test('firing and the test step never call our own API', async () => {
  for (const trigger of hooks()) {
    const { sample } = trigger.operation;

    await trigger.operation.perform(refusing, delivery(payloadFor(sample.event)));
    await trigger.operation.performList(refusing, { inputData: {} });
  }
});

test('every trigger requires the API token that lets it subscribe itself', () => {
  hooks().forEach((trigger) => {
    const byKey = Object.fromEntries(trigger.operation.inputFields.map((field) => [field.key, field]));

    assert.equal(byKey.api_token.required, true);
    assert.equal(byKey.api_token.type, 'password');
    assert.match(byKey.api_token.helpText, /session-replay\.com\/app\/settings/);
    assert.doesNotMatch(byKey.api_token.helpText, /blank/);
  });
});

test('the signing key help asks for the key rather than telling the Zap to do without it', () => {
  hooks().forEach((trigger) => {
    const byKey = Object.fromEntries(trigger.operation.inputFields.map((field) => [field.key, field]));

    assert.match(byKey.signing_key.helpText, /Paste it/);
    assert.doesNotMatch(byKey.signing_key.helpText, /Leave it blank/);
  });
});

const teamList = app.triggers.teamList;

class StubbedZapierError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ZapierError';
    this.code = code;
    this.status = status;
  }
}

const api = (...replies) => {
  const calls = [];
  const queue = [...replies];

  return {
    calls,
    z: {
      errors: { Error: StubbedZapierError },
      request: async (options) => {
        calls.push(options);

        const reply = queue.length > 1 ? queue.shift() : queue[0];

        return {
          status: reply.status ?? 200,
          data: reply.data,
          throwForStatus() {
            throw new Error(`the platform threw for HTTP ${reply.status}`);
          }
        };
      }
    }
  };
};

const teamsPage = (names, next) => ({
  status: 200,
  data: {
    data: names.map((name, index) => ({ id: `${name}-${index}`, type: 'team', attributes: { name } })),
    links: next ? { next } : {},
    meta: { has_next_page: Boolean(next) }
  }
});

const subscribeWith = async (inputData, reply = { status: 201, data: created('42', SECRET) }) => {
  const trigger = keyed(events.REPORT_CREATED);
  const { z, calls } = api(reply);

  const subscription = await trigger.operation.performSubscribe(z, {
    targetUrl: TARGET_URL,
    inputData: { api_token: TOKEN, ...inputData }
  });

  return { calls, subscription };
};

test('a Zap that names no team sends no team_id, so the destination stays where it is', async () => {
  const { calls } = await subscribeWith({});

  assert.equal('team_id' in calls[0].body, false);
});

test('a team of nothing but spaces counts as no team at all', async () => {
  const { calls } = await subscribeWith({ team_id: '   ' });

  assert.equal('team_id' in calls[0].body, false);
});

test('the team the author picked is the team the destination is created on', async () => {
  const { calls } = await subscribeWith({ team_id: 'a-team-id' });

  assert.equal(calls[0].body.team_id, 'a-team-id');
  assert.deepEqual(calls[0].body, {
    url: TARGET_URL,
    events: [events.REPORT_CREATED],
    team_id: 'a-team-id'
  });
});

test('a team the account belongs to but does not administer says so', async () => {
  await assert.rejects(
    async () => subscribeWith({ team_id: 'a-team-id' }, { status: 403, data: {} }),
    (error) => {
      assert.equal(error.message, hook.TEAM_FORBIDDEN_MESSAGE);
      assert.equal(error.code, 'TeamForbidden');
      assert.equal(error.status, 403);

      return true;
    }
  );
});

test('a team this account has nothing to do with asks for another one', async () => {
  await assert.rejects(
    async () => subscribeWith({ team_id: 'a-team-id' }, { status: 404, data: {} }),
    (error) => {
      assert.equal(error.message, hook.TEAM_NOT_FOUND_MESSAGE);
      assert.equal(error.code, 'TeamNotFound');
      assert.equal(error.status, 404);

      return true;
    }
  );
});

test('any other refusal is left to the platform rather than dressed up as a team problem', async () => {
  await assert.rejects(
    async () => subscribeWith({ team_id: 'a-team-id' }, { status: 500, data: {} }),
    /the platform threw for HTTP 500/
  );
});

test('the team field is offered the teams this token can see, by name', async () => {
  const { z, calls } = api(teamsPage(['Zebra crew', 'apricot', 'Mango']));

  const teams = await teamList.operation.perform(z, { inputData: { api_token: TOKEN } });

  assert.equal(calls[0].method, 'GET');
  assert.match(calls[0].url, /^https:\/\/session-replay\.com\/api\/v1\/teams\?/);
  assert.equal(calls[0].headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(teams.map((team) => team.name), ['apricot', 'Mango', 'Zebra crew']);
  assert.deepEqual(teams.map((team) => team.id), ['apricot-1', 'Mango-2', 'Zebra crew-0']);
});

test('a second page of teams is fetched, so a long list is not silently cut in half', async () => {
  const next = 'https://session-replay.com/api/v1/teams?page%5Bafter%5D=cursor&page%5Bsize%5D=100';
  const { z, calls } = api(teamsPage(['Ants'], next), teamsPage(['Bees']));

  const teams = await teamList.operation.perform(z, { inputData: { api_token: TOKEN } });

  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, next);
  assert.deepEqual(teams.map((team) => team.name), ['Ants', 'Bees']);
});

test('an endless list of pages stops at the cap rather than fetching for ever', async () => {
  const next = 'https://session-replay.com/api/v1/teams?page%5Bafter%5D=cursor&page%5Bsize%5D=100';
  const { z, calls } = api(teamsPage(['Ants'], next));

  const teams = await teamList.operation.perform(z, { inputData: { api_token: TOKEN } });

  assert.equal(calls.length, hook.TEAM_PAGE_LIMIT);
  assert.equal(teams.length, hook.TEAM_PAGE_LIMIT);
});

test('a listing that fails says the teams could not be read rather than showing an empty menu', async () => {
  const { z } = api({ status: 401, data: {} });

  await assert.rejects(
    async () => teamList.operation.perform(z, { inputData: { api_token: TOKEN } }),
    (error) => {
      assert.equal(error.message, hook.teamListFailedMessage(401));
      assert.equal(error.code, 'TeamListFailed');

      return true;
    }
  );
});

test('the team menu asks for the API token rather than calling the API without one', async () => {
  await assert.rejects(
    async () => teamList.operation.perform(refusing, { inputData: {} }),
    hook.MissingApiToken
  );
});

test('the team field is optional, so a Zap with one team is not asked a question with one answer', () => {
  hooks().forEach((trigger) => {
    const byKey = Object.fromEntries(trigger.operation.inputFields.map((field) => [field.key, field]));

    assert.equal(byKey.team_id.required, false);
    assert.match(byKey.team_id.helpText, /Leave this blank to use your personal team/);
    assert.match(byKey.team_id.helpText, /owner or admin/);
  });
});
