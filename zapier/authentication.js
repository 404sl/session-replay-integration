const { BASE_URL, SITES_PATH, body } = require('./lib/api');

const API_KEY_HELP =
  'Create one at https://session-replay.com/app/settings and paste it here. ' +
  'It is only used to load recent reports when you test a trigger.';

const SIGNING_KEY_HELP =
  'Optional. The signing key shown once when you add the webhook at ' +
  'https://session-replay.com/app/connectors. Given it, every incoming request is checked ' +
  'against the signature Session Replay sends. Left blank, the Zap accepts anything posted ' +
  'to its webhook URL.';

const test = async (z) => {
  const response = await z.request({ url: `${BASE_URL}${SITES_PATH}`, params: { 'page[size]': 1 } });

  return body(response);
};

const connectionLabel = (z, bundle) => {
  const first = Array.isArray(bundle.inputData?.data) ? bundle.inputData.data[0] : null;

  return first?.attributes?.domain || 'Session Replay';
};

const includeBearer = (request, z, bundle) => {
  if (bundle.authData?.api_key) {
    request.headers = { ...request.headers, Authorization: `Bearer ${bundle.authData.api_key}` };
  }

  return request;
};

const authentication = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API token',
      type: 'password',
      required: true,
      helpText: API_KEY_HELP
    },
    {
      key: 'signing_key',
      label: 'Webhook signing key',
      type: 'password',
      required: false,
      helpText: SIGNING_KEY_HELP
    }
  ],
  test,
  connectionLabel
};

module.exports = { authentication, includeBearer, test, connectionLabel };
