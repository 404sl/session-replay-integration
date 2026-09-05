const events = require('./events');

const REPORT_ID = '9f1c2b7e-4d3a-4f61-9c0b-7a2e5d8f1b34';
const SHARE_TOKEN = 'P1pYbqoNfxugn9p_XnhSfw';
const DELIVERY_ID = '3c8d1a6b-2f45-4e90-8b17-5d0c9e3a7f21';
const SITE_ID = 'a4e7d210-8b93-4c56-9f0e-1d2b3c4a5e6f';
const SENT_AT = '2026-09-05T11:42:07Z';
const CREATED_AT = '2026-09-05T11:42:05Z';

const statuses = {
  [events.REPORT_CREATED]: 'pending',
  [events.REPORT_STATUS_CHANGED]: 'in_progress',
  [events.REPORT_SEVERITY_CHANGED]: 'pending',
  [events.REPORT_FIRST_VIEWED]: 'pending',
  [events.REPORT_SENT]: 'pending'
};

const severities = {
  [events.REPORT_SEVERITY_CHANGED]: 'critical'
};

const payloadFor = (event) => ({
  event,
  version: events.PAYLOAD_VERSION,
  sent_at: SENT_AT,
  data: {
    report: {
      id: REPORT_ID,
      share_token: SHARE_TOKEN,
      share_url: `https://session-replay.com/replays/${SHARE_TOKEN}`,
      status: statuses[event],
      severity: severities[event] ?? 'major',
      created_at: CREATED_AT,
      updated_at: SENT_AT
    },
    site: { id: SITE_ID, domain: 'example.com' }
  }
});

const sampleFor = (event) => {
  const payload = payloadFor(event);

  return {
    id: DELIVERY_ID,
    event: payload.event,
    version: payload.version,
    sent_at: payload.sent_at,
    report: payload.data.report,
    site: payload.data.site
  };
};

module.exports = { DELIVERY_ID, REPORT_ID, SHARE_TOKEN, SITE_ID, payloadFor, sampleFor };
