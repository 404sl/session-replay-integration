const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const signature = require('../lib/signature');

const SECRET = 'whsec_a-destination-signing-key';

const sign = (body, secret = SECRET, seconds = Math.floor(Date.now() / 1000)) =>
  `t=${seconds},v1=${crypto.createHmac('sha256', secret).update(`${seconds}.${body}`).digest('hex')}`;

test('it accepts a header built the way the app builds it', () => {
  const body = JSON.stringify({ event: 'report.created' });

  assert.equal(signature.verify({ body, secret: SECRET, signature: sign(body) }), true);
});

test('it rejects a body that was altered after signing', () => {
  const body = JSON.stringify({ event: 'report.created' });
  const header = sign(body);

  assert.throws(
    () => signature.verify({ body: `${body} `, secret: SECRET, signature: header }),
    signature.InvalidSignature
  );
});

test('it rejects a signature made with another key', () => {
  const body = JSON.stringify({ event: 'report.created' });

  assert.throws(
    () => signature.verify({ body, secret: SECRET, signature: sign(body, 'a-different-key') }),
    signature.InvalidSignature
  );
});

test('it rejects a captured request replayed after the tolerance', () => {
  const body = JSON.stringify({ event: 'report.created' });
  const then = Math.floor(Date.now() / 1000) - (signature.TOLERANCE_SECONDS + 1);

  assert.throws(
    () => signature.verify({ body, secret: SECRET, signature: sign(body, SECRET, then) }),
    signature.InvalidSignature
  );
});

test('it accepts a delivery still inside the tolerance', () => {
  const body = JSON.stringify({ event: 'report.created' });
  const then = Math.floor(Date.now() / 1000) - (signature.TOLERANCE_SECONDS - 5);

  assert.equal(signature.verify({ body, secret: SECRET, signature: sign(body, SECRET, then) }), true);
});

test('it rejects a request that arrived without a signature', () => {
  assert.throws(
    () => signature.verify({ body: '{}', secret: SECRET, signature: undefined }),
    signature.InvalidSignature
  );
});

test('it rejects a request whose raw body was not available to check', () => {
  const body = JSON.stringify({ event: 'report.created' });

  assert.throws(
    () => signature.verify({ body: undefined, secret: SECRET, signature: sign(body) }),
    signature.InvalidSignature
  );
});

test('it reads a header name however the request cased it', () => {
  const headers = { 'x-session-replay-signature': 't=1,v1=abc' };

  assert.equal(signature.header(headers, signature.HEADER), 't=1,v1=abc');
  assert.equal(signature.header({}, signature.HEADER), undefined);
  assert.equal(signature.header(undefined, signature.HEADER), undefined);
});

test('it matches the header names the app sends', () => {
  assert.equal(signature.HEADER, 'X-Session-Replay-Signature');
  assert.equal(signature.EVENT_HEADER, 'X-Session-Replay-Event');
  assert.equal(signature.DELIVERY_HEADER, 'X-Session-Replay-Delivery');
});
