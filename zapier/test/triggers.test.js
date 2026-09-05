const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const app = require('../app');
const events = require('../lib/events');
const signature = require('../lib/signature');
const { payloadFor, DELIVERY_ID } = require('../lib/samples');

const SECRET = 'whsec_a-destination-signing-key';

const delivery = (payload, { secret = null, deliveryId = DELIVERY_ID } = {}) => {
  const content = JSON.stringify(payload);
  const seconds = Math.floor(Date.now() / 1000);
  const headers = { 'X-Session-Replay-Event': payload.event, 'X-Session-Replay-Delivery': deliveryId };

  if (secret) {
    const digest = crypto.createHmac('sha256', secret).update(`${seconds}.${content}`).digest('hex');

    headers['X-Session-Replay-Signature'] = `t=${seconds},v1=${digest}`;
  }

  return { cleanedRequest: payload, rawRequest: { content, headers }, authData: {} };
};

const keyed = (event) => Object.values(app.triggers).find((trigger) => trigger.operation.sample.event === event);

test('every event the app emits has a trigger', () => {
  assert.deepEqual(
    Object.keys(app.triggers).sort(),
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

test('the signature is checked when the connection carries a signing key', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  const signed = delivery(payload, { secret: SECRET });
  signed.authData = { signing_key: SECRET };

  const results = await trigger.operation.perform({}, signed);

  assert.equal(results.length, 1);
});

test('a forged delivery is refused when the connection carries a signing key', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const payload = payloadFor(events.REPORT_CREATED);

  const forged = delivery(payload, { secret: 'not-the-signing-key' });
  forged.authData = { signing_key: SECRET };

  await assert.rejects(
    async () => trigger.operation.perform({}, forged),
    signature.InvalidSignature
  );
});

test('an unsigned delivery is refused when the connection carries a signing key', async () => {
  const trigger = keyed(events.REPORT_CREATED);
  const unsigned = delivery(payloadFor(events.REPORT_CREATED));
  unsigned.authData = { signing_key: SECRET };

  await assert.rejects(
    async () => trigger.operation.perform({}, unsigned),
    signature.InvalidSignature
  );
});

test('an unsigned delivery is accepted when no signing key was given', async () => {
  const trigger = keyed(events.REPORT_CREATED);

  const results = await trigger.operation.perform({}, delivery(payloadFor(events.REPORT_CREATED)));

  assert.equal(results.length, 1);
});

test('every trigger ships a sample shaped like what perform returns', async () => {
  for (const trigger of Object.values(app.triggers)) {
    const { sample } = trigger.operation;
    const [live] = await trigger.operation.perform({}, delivery(payloadFor(sample.event)));

    assert.deepEqual(Object.keys(sample).sort(), Object.keys(live).sort(), trigger.key);
    assert.deepEqual(Object.keys(sample.report).sort(), Object.keys(live.report).sort(), trigger.key);
    assert.deepEqual(Object.keys(sample.site).sort(), Object.keys(live.site).sort(), trigger.key);
  }
});

test('every output field names something the sample actually carries', () => {
  Object.values(app.triggers).forEach((trigger) => {
    const { sample, outputFields } = trigger.operation;

    outputFields.forEach(({ key }) => {
      const [head, tail] = key.split('__');
      const present = tail === undefined ? head in sample : sample[head] !== null && tail in sample[head];

      assert.ok(present, `${trigger.key} advertises ${key}, which is not in its sample`);
    });
  });
});
