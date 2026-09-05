class UnidentifiedDelivery extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnidentifiedDelivery';
  }
}

const reportOf = (source) => ({
  id: source.id ?? null,
  share_token: source.share_token ?? null,
  share_url: source.share_url ?? null,
  status: source.status ?? null,
  severity: source.severity ?? null,
  created_at: source.created_at ?? null,
  updated_at: source.updated_at ?? null
});

const siteOf = (site) => (site ? { id: site.id ?? null, domain: site.domain ?? null } : null);

const identify = (payload, report) => {
  if (!payload?.sent_at) {
    throw new UnidentifiedDelivery(
      'This delivery carried neither an X-Session-Replay-Delivery header nor a sent_at, ' +
        'so there is nothing to deduplicate it by.'
    );
  }

  return `${payload.event}:${report.id}:${payload.sent_at}`;
};

const fromWebhook = (payload, deliveryId) => {
  const data = payload?.data ?? {};
  const report = data.report ?? {};

  return {
    id: deliveryId || identify(payload, report),
    event: payload?.event ?? null,
    version: payload?.version ?? null,
    sent_at: payload?.sent_at ?? null,
    report: reportOf(report),
    site: siteOf(data.site)
  };
};

module.exports = { UnidentifiedDelivery, reportOf, identify, fromWebhook };
