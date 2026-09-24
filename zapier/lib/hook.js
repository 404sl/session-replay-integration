const signature = require('./signature');
const { fromWebhook } = require('./report');
const { sampleFor } = require('./samples');
const { OUTPUT_FIELDS } = require('./output_fields');

const API_BASE = 'https://session-replay.com';
const DESTINATIONS_URL = `${API_BASE}/api/v1/webhook_destinations`;
const ZAPIER_DESTINATIONS_URL = `${API_BASE}/api/v1/zapier/webhook_destinations`;
const TEAMS_URL = `${API_BASE}/api/v1/teams`;
const SITES_URL = `${API_BASE}/api/v1/sites`;

const TEAM_PAGE_SIZE = 100;
const TEAM_PAGE_LIMIT = 5;
const SITE_PAGE_SIZE = 100;
const SITE_PAGE_LIMIT = 5;

// The account authorizes Session Replay once through OAuth, so the access token rides on every
// request via the app's beforeRequest middleware. Nothing here reads or asks for a token.

const SIGNING_KEY_HELP =
  'The signing key of the webhook destination this Zap registers when you turn it on. Paste it ' +
  'here: turning the Zap on keeps the key handed back with the destination, but a pasted key is ' +
  'the only one the Zap is certain to have when a delivery arrives. To get it, open that ' +
  'destination under Connectors at [session-replay.com](https://session-replay.com), rotate its ' +
  'secret, and copy what ' +
  'the screen shows. It belongs to that one destination, so each Zap has its own, and rotating ' +
  'it again stops this Zap until the new key is pasted here. Given a key, every incoming request ' +
  'is checked against the signature Session Replay sends; without one, the Zap accepts anything ' +
  'posted to its URL.';

const TEAM_HELP =
  'Which team receives these reports. Leave this blank to use your personal team. You must be an ' +
  'owner or admin of the team you pick.';

const SITE_HELP =
  'Only fire for reports from this domain. Leave this blank to fire for every domain on the team. ' +
  'Pick a team first: the list shows the domains of the team chosen above.';

const SITE_REFUSED_MESSAGE =
  'Session Replay refused that domain: it does not belong to the team this Zap connects to. Open ' +
  'the Domain field and pick a domain of that team, or leave it blank for every domain.';

const TEAM_FORBIDDEN_MESSAGE =
  'Session Replay refused that team: your account belongs to it but is not an owner or admin of ' +
  'it. Pick a team you administer, or ask one of its admins to connect the Zap.';

const TEAM_NOT_FOUND_MESSAGE =
  'Session Replay does not recognise that team for this account. Open the Team field and pick ' +
  'your team again.';

const siteListFailedMessage = (status) =>
  `Session Replay could not list the team's domains (HTTP ${status}). Check the Session Replay ` +
  'connection and try again.';

const teamListFailedMessage = (status) =>
  `Session Replay could not list your teams (HTTP ${status}). Check the Session Replay connection ` +
  'and try again.';

const INPUT_FIELDS = [
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
    altersDynamicFields: true,
    helpText: TEAM_HELP
  },
  {
    key: 'site_id',
    label: 'Domain',
    type: 'string',
    required: false,
    dynamic: 'siteList.id.domain',
    helpText: SITE_HELP
  }
];

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

const chosen = (bundle, key) => {
  const value = bundle.inputData?.[key];

  return typeof value === 'string' && value.trim() ? value : null;
};

const chosenTeam = (bundle) => chosen(bundle, 'team_id');

const chosenSite = (bundle) => chosen(bundle, 'site_id');

const refusal = (z, status, { team, site }) => {
  if (site && status === 422) return new z.errors.Error(SITE_REFUSED_MESSAGE, 'SiteRefused', 422);
  if (!team) return null;
  if (status === 403) return new z.errors.Error(TEAM_FORBIDDEN_MESSAGE, 'TeamForbidden', 403);
  if (status === 404) return new z.errors.Error(TEAM_NOT_FOUND_MESSAGE, 'TeamNotFound', 404);

  return null;
};

const performSubscribeFor = (event) => async (z, bundle) => {
  const team = chosenTeam(bundle);
  const site = chosenSite(bundle);
  const body = { url: bundle.targetUrl, events: [event] };

  if (team) body.team_id = team;
  if (site) body.site_id = site;

  const response = await z.request({
    url: ZAPIER_DESTINATIONS_URL,
    method: 'POST',
    body,
    skipThrowForStatus: true
  });

  if (response.status >= 400) {
    const refused = refusal(z, response.status, { team, site });

    if (refused) throw refused;

    response.throwForStatus();
  }

  return subscription(response);
};

const onlyMine = (url) => {
  const parsed = new URL(url);

  parsed.searchParams.set('membership', 'mine');

  return parsed.toString();
};

const teamsPage = async (z, url) => {
  const response = await z.request({
    url: onlyMine(url),
    method: 'GET',
    skipThrowForStatus: true
  });

  if (response.status >= 400) {
    throw new z.errors.Error(teamListFailedMessage(response.status), 'TeamListFailed', response.status);
  }

  return response.data ?? {};
};

const listTeams = async (z) => {
  const teams = [];
  let url = `${TEAMS_URL}?page[size]=${TEAM_PAGE_SIZE}`;

  for (let page = 0; page < TEAM_PAGE_LIMIT && url; page += 1) {
    const body = await teamsPage(z, url);

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
    inputFields: [],
    perform: listTeams
  }
};

const ofTeam = (url, team) => {
  const parsed = new URL(url);

  parsed.searchParams.set('team_id', team);

  return parsed.toString();
};

const sitesPage = async (z, url, team) => {
  const response = await z.request({
    url: ofTeam(url, team),
    method: 'GET',
    skipThrowForStatus: true
  });

  if (response.status >= 400) {
    throw new z.errors.Error(siteListFailedMessage(response.status), 'SiteListFailed', response.status);
  }

  return response.data ?? {};
};

const listSites = async (z, bundle) => {
  const team = chosenTeam(bundle);
  const sites = [];

  if (!team) return sites;

  let url = `${SITES_URL}?page[size]=${SITE_PAGE_SIZE}`;

  for (let page = 0; page < SITE_PAGE_LIMIT && url; page += 1) {
    const body = await sitesPage(z, url, team);

    (body.data ?? []).forEach((row) => sites.push({ id: row.id, domain: row.attributes?.domain }));

    url = body.links?.next;
  }

  return sites.sort((one, other) => `${one.domain}`.localeCompare(`${other.domain}`, undefined, { sensitivity: 'base' }));
};

const siteListTrigger = {
  key: 'siteList',
  noun: 'Domain',
  display: {
    label: 'Domain',
    description: 'Lists the domains of the team chosen on the trigger.',
    hidden: true
  },
  operation: {
    inputFields: [],
    perform: listSites
  }
};

const performUnsubscribe = async (z, bundle) => {
  const id = bundle.subscribeData?.id;

  if (!id) return {};

  await z.request({
    url: `${DESTINATIONS_URL}/${id}`,
    method: 'DELETE'
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
  ZAPIER_DESTINATIONS_URL,
  TEAMS_URL,
  SITES_URL,
  TEAM_PAGE_LIMIT,
  SITE_PAGE_LIMIT,
  INPUT_FIELDS,
  SIGNING_KEY_HELP,
  TEAM_HELP,
  SITE_HELP,
  SITE_REFUSED_MESSAGE,
  TEAM_FORBIDDEN_MESSAGE,
  TEAM_NOT_FOUND_MESSAGE,
  teamListFailedMessage,
  siteListFailedMessage,
  performFor,
  performListFor,
  performSubscribeFor,
  performUnsubscribe,
  listTeams,
  teamListTrigger,
  listSites,
  siteListTrigger,
  triggerFor
};
