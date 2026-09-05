const crypto = require('node:crypto');

const HEADER = 'X-Session-Replay-Signature';
const EVENT_HEADER = 'X-Session-Replay-Event';
const DELIVERY_HEADER = 'X-Session-Replay-Delivery';
const SCHEME = 'v1';
const TOLERANCE_SECONDS = 300;

class InvalidSignature extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidSignature';
  }
}

const header = (headers, name) => {
  if (!headers) return undefined;

  const wanted = name.toLowerCase();
  const found = Object.keys(headers).find((key) => key.toLowerCase() === wanted);

  return found === undefined ? undefined : headers[found];
};

const parse = (value) => {
  const parts = String(value === undefined || value === null ? '' : value).split(',');
  const fields = {};

  parts.forEach((part) => {
    const at = part.indexOf('=');

    if (at > 0) fields[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  });

  const timestamp = Number.parseInt(fields.t, 10);

  return { timestamp, digest: fields[SCHEME] };
};

const digest = (body, secret, timestamp) =>
  crypto.createHmac('sha256', String(secret)).update(`${timestamp}.${body}`).digest('hex');

const same = (a, b) => {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');

  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const verify = ({ body, secret, signature, now = Date.now() }) => {
  if (typeof body !== 'string') {
    throw new InvalidSignature('The raw request body was not available to check the signature against.');
  }

  const { timestamp, digest: sent } = parse(signature);

  if (!Number.isFinite(timestamp) || !sent) {
    throw new InvalidSignature(`No ${SCHEME} signature was sent with this request.`);
  }

  if (Math.abs(Math.floor(now / 1000) - timestamp) > TOLERANCE_SECONDS) {
    throw new InvalidSignature('The signature timestamp is outside the accepted window.');
  }

  if (!same(sent, digest(body, secret, timestamp))) {
    throw new InvalidSignature('The signature does not match the signing key on this connection.');
  }

  return true;
};

module.exports = {
  HEADER,
  EVENT_HEADER,
  DELIVERY_HEADER,
  SCHEME,
  TOLERANCE_SECONDS,
  InvalidSignature,
  header,
  parse,
  digest,
  verify
};
