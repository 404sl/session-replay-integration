const signature = require('./signature');
const { fromWebhook } = require('./report');
const { sampleFor } = require('./samples');
const { OUTPUT_FIELDS } = require('./output_fields');

const API_BASE = 'https://session-replay.com';
const DESTINATIONS_URL = `${API_BASE}/api/v1/webhook_destinations`;
const SETTINGS_URL = `${API_BASE}/app/settings`;

class MissingApiToken extends Error {
  constructor(message) {
    super(message);
    this.name = 'MissingApiToken';
  }
}

const MISSING_TOKEN_MESSAGE =
  `Paste an API token from ${SETTINGS_URL} into this trigger's API token field. Without one ` +
  'this Zap cannot register its webhook URL with Session Replay, so nothing would ever reach it.';

const SIGNING_KEY_HELP =
  'The signing key of the webhook destination this Zap registers when you turn it on. Paste it ' +
  'here: turning the Zap on keeps the key handed back with the destination, but a pasted key is ' +
  'the only one the Zap is certain to have when a delivery arrives. To get it, open that ' +
  'destination under Connectors on https://session-replay.com, rotate its secret, and copy what ' +
  'the screen shows. It belongs to that one destination, so each Zap has its own, and rotating ' +
  'it again stops this Zap until the new key is pasted here. Given a key, every incoming request ' +
  'is checked against the signature Session Replay sends; without one, the Zap accepts anything ' +
  'posted to its URL.';

const API_TOKEN_HELP =
  `An API token from ${SETTINGS_URL}. Turning this Zap on uses it to register the Zap's own ` +
  'webhook URL as a destination subscribed to this one event, and turning the Zap off removes ' +
  'that destination again. A token is short lived, so paste a fresh one whenever you turn the ' +
  'Zap on. If it has expired by the time you turn the Zap off, the destination stays behind and ' +
  'is removed under Connectors instead.';

const INPUT_FIELDS = [
  {
    key: 'api_token',
    label: 'API token',
    type: 'password',
    required: true,
    helpText: API_TOKEN_HELP
  },
  {
    key: 'signing_key',
    label: 'Webhook signing key',
    type: 'password',
    required: false,
    helpText: SIGNING_KEY_HELP
  }
];

const bearer = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
});

const subscription = (response) => {
  const resource = response?.data?.data ?? {};

  return { id: resource.id, secret: resource.attributes?.secret };
};

const performFor = (event) => (z, bundle) => {
  const payload = bundle.cleanedRequest ?? {};
  const raw = bundle.rawRequest ?? {};
  const secret = bundle.inputData?.signing_key || bundle.subscribeData?.secret;

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

const performSubscribeFor = (event) => async (z, bundle) => {
  const token = bundle.inputData?.api_token;

  if (!token) throw new MissingApiToken(MISSING_TOKEN_MESSAGE);

  const response = await z.request({
    url: DESTINATIONS_URL,
    method: 'POST',
    headers: bearer(token),
    body: { url: bundle.targetUrl, events: [event] }
  });

  return subscription(response);
};

const performUnsubscribe = async (z, bundle) => {
  const token = bundle.inputData?.api_token;
  const id = bundle.subscribeData?.id;

  if (!token || !id) return {};

  await z.request({
    url: `${DESTINATIONS_URL}/${id}`,
    method: 'DELETE',
    headers: bearer(token)
  });

  return { id };
};

const triggerFor = ({ key, event, noun, label, description }) => ({
  key,
  noun,
  display: { label, description },
  operation: {
    type: 'hook',
    inputFields: INPUT_FIELDS,
    perform: performFor(event),
    performList: performListFor(event),
    performSubscribe: performSubscribeFor(event),
    performUnsubscribe,
    outputFields: OUTPUT_FIELDS,
    sample: sampleFor(event)
  }
});

module.exports = {
  API_BASE,
  DESTINATIONS_URL,
  SETTINGS_URL,
  INPUT_FIELDS,
  SIGNING_KEY_HELP,
  API_TOKEN_HELP,
  MissingApiToken,
  MISSING_TOKEN_MESSAGE,
  performFor,
  performListFor,
  performSubscribeFor,
  performUnsubscribe,
  triggerFor
};
