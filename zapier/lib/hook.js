const signature = require('./signature');
const { fromWebhook } = require('./report');
const { sampleFor } = require('./samples');
const { OUTPUT_FIELDS } = require('./output_fields');

const SIGNING_KEY_HELP =
  'Optional. The signing key shown once when you paste this Zap\'s webhook URL into a ' +
  'destination on https://session-replay.com/app/connectors. It belongs to that one ' +
  'destination, so each Zap has its own, and rotating it on that screen stops this Zap ' +
  'until the new key is pasted here. Given it, every incoming request is checked against ' +
  'the signature Session Replay sends. Left blank, the Zap accepts anything posted to its URL.';

const INPUT_FIELDS = [
  {
    key: 'signing_key',
    label: 'Webhook signing key',
    type: 'password',
    required: false,
    helpText: SIGNING_KEY_HELP
  }
];

const performFor = (event) => (z, bundle) => {
  const payload = bundle.cleanedRequest ?? {};
  const raw = bundle.rawRequest ?? {};
  const secret = bundle.inputData?.signing_key;

  if (secret) {
    signature.verify({
      body: raw.content,
      secret,
      signature: signature.header(raw.headers, signature.HEADER)
    });
  }

  if (payload.event !== event) return [];

  return [fromWebhook(payload, signature.header(raw.headers, signature.DELIVERY_HEADER))];
};

const performListFor = (event) => () => [sampleFor(event)];

const triggerFor = ({ key, event, noun, label, description }) => ({
  key,
  noun,
  display: { label, description },
  operation: {
    type: 'hook',
    inputFields: INPUT_FIELDS,
    perform: performFor(event),
    performList: performListFor(event),
    outputFields: OUTPUT_FIELDS,
    sample: sampleFor(event)
  }
});

module.exports = { INPUT_FIELDS, SIGNING_KEY_HELP, performFor, performListFor, triggerFor };
