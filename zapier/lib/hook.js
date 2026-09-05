const signature = require('./signature');
const { BASE_URL, REPLAYS_PATH, body } = require('./api');
const { fromWebhook, fromApiCollection } = require('./report');
const { sampleFor } = require('./samples');
const { OUTPUT_FIELDS } = require('./output_fields');

const LIST_SIZE = 3;

const performFor = (event) => (z, bundle) => {
  const payload = bundle.cleanedRequest ?? {};
  const raw = bundle.rawRequest ?? {};
  const secret = bundle.authData?.signing_key;

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

const performListFor = (event) => async (z) => {
  const response = await z.request({
    url: `${BASE_URL}${REPLAYS_PATH}`,
    params: { include: 'site', 'page[size]': LIST_SIZE }
  });

  return fromApiCollection(body(response), event);
};

const triggerFor = ({ key, event, noun, label, description }) => ({
  key,
  noun,
  display: { label, description },
  operation: {
    type: 'hook',
    perform: performFor(event),
    performList: performListFor(event),
    outputFields: OUTPUT_FIELDS,
    sample: sampleFor(event)
  }
});

module.exports = { LIST_SIZE, performFor, performListFor, triggerFor };
