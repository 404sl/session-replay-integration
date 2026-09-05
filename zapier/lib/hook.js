const signature = require('./signature');
const { fromWebhook } = require('./report');
const { sampleFor } = require('./samples');
const { OUTPUT_FIELDS } = require('./output_fields');

const API_BASE = 'https://session-replay.com';
const DESTINATIONS_URL = `${API_BASE}/api/v1/webhook_destinations`;
const TEAMS_URL = `${API_BASE}/api/v1/teams`;
const SETTINGS_URL = `${API_BASE}/app/settings`;

const TEAM_PAGE_SIZE = 100;
const TEAM_PAGE_LIMIT = 5;

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

const TEAM_HELP =
  'Which team receives these reports. Leave this blank to use your personal team. You must be an ' +
  'owner or admin of the team you pick.';

const TEAM_FORBIDDEN_MESSAGE =
  'Session Replay refused that team: your account belongs to it but is not an owner or admin of ' +
  'it. Pick a team you administer, or ask one of its admins to connect the Zap.';

const TEAM_NOT_FOUND_MESSAGE =
  'Session Replay does not recognise that team for this account. Open the Team field and pick ' +
  'your team again.';

const teamListFailedMessage = (status) =>
  `Session Replay could not list your teams (HTTP ${status}). Check the Session Replay connection ` +
  'and try again.';

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
  },
  {
    key: 'team_id',
    label: 'Team',
    type: 'string',
    required: false,
    dynamic: 'teamList.id.name',
    altersDynamicFields: false,
    helpText: TEAM_HELP
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

const chosenTeam = (bundle) => {
  const team = bundle.inputData?.team_id;

  return typeof team === 'string' && team.trim() ? team : null;
};

const refusal = (z, status) => {
  if (status === 403) return new z.errors.Error(TEAM_FORBIDDEN_MESSAGE, 'TeamForbidden', 403);
  if (status === 404) return new z.errors.Error(TEAM_NOT_FOUND_MESSAGE, 'TeamNotFound', 404);

  return null;
};

const performSubscribeFor = (event) => async (z, bundle) => {
  const token = bundle.inputData?.api_token;

  if (!token) throw new MissingApiToken(MISSING_TOKEN_MESSAGE);

  const team = chosenTeam(bundle);
  const body = { url: bundle.targetUrl, events: [event] };

  if (team) body.team_id = team;

  const response = await z.request({
    url: DESTINATIONS_URL,
    method: 'POST',
    headers: bearer(token),
    body,
    skipThrowForStatus: true
  });

  if (response.status >= 400) {
    const refused = refusal(z, response.status);

    if (refused) throw refused;

    response.throwForStatus();
  }

  return subscription(response);
};

const teamsPage = async (z, token, url) => {
  const response = await z.request({
    url,
    method: 'GET',
    headers: bearer(token),
    skipThrowForStatus: true
  });

  if (response.status >= 400) {
    throw new z.errors.Error(teamListFailedMessage(response.status), 'TeamListFailed', response.status);
  }

  return response.data ?? {};
};

const listTeams = async (z, bundle) => {
  const token = bundle.inputData?.api_token;

  if (!token) throw new MissingApiToken(MISSING_TOKEN_MESSAGE);

  const teams = [];
  let url = `${TEAMS_URL}?page[size]=${TEAM_PAGE_SIZE}`;

  for (let page = 0; page < TEAM_PAGE_LIMIT && url; page += 1) {
    const body = await teamsPage(z, token, url);

    (body.data ?? []).forEach((row) => teams.push({ id: row.id, name: row.attributes?.name }));

    url = body.links?.next;
  }

  return teams.sort((one, other) => `${one.name}`.localeCompare(`${other.name}`, undefined, { sensitivity: 'base' }));
};

const teamListTrigger = {
  key: 'teamList',
  noun: 'Team',
  display: {
    label: 'Team',
    description: 'Lists the teams this account can use.',
    hidden: true
  },
  operation: {
    perform: listTeams
  }
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
  TEAMS_URL,
  SETTINGS_URL,
  TEAM_PAGE_LIMIT,
  INPUT_FIELDS,
  SIGNING_KEY_HELP,
  API_TOKEN_HELP,
  TEAM_HELP,
  TEAM_FORBIDDEN_MESSAGE,
  TEAM_NOT_FOUND_MESSAGE,
  teamListFailedMessage,
  MissingApiToken,
  MISSING_TOKEN_MESSAGE,
  performFor,
  performListFor,
  performSubscribeFor,
  performUnsubscribe,
  listTeams,
  teamListTrigger,
  triggerFor
};
