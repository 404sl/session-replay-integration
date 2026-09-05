const { included } = require('./api');

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

const fromWebhook = (payload, deliveryId) => {
  const data = payload?.data ?? {};
  const report = data.report ?? {};

  return {
    id: deliveryId || `${payload?.event}:${report.id}`,
    event: payload?.event ?? null,
    version: payload?.version ?? null,
    sent_at: payload?.sent_at ?? null,
    report: reportOf(report),
    site: siteOf(data.site)
  };
};

const fromApi = (resource, document, event) => {
  const attributes = resource.attributes ?? {};
  const link = resource.relationships?.site?.data;
  const site = link ? included(document, 'site', link.id) : null;

  return {
    id: resource.id,
    event,
    version: 1,
    sent_at: attributes.updated_at ?? null,
    report: reportOf({
      id: resource.id,
      share_token: attributes.share_token,
      share_url: attributes.share_url,
      status: attributes.resolution_status,
      severity: null,
      created_at: attributes.created_at,
      updated_at: attributes.updated_at
    }),
    site: site ? siteOf({ id: site.id, domain: site.attributes?.domain }) : null
  };
};

const fromApiCollection = (document, event) => {
  const rows = Array.isArray(document?.data) ? document.data : [];

  return rows.map((resource) => fromApi(resource, document, event));
};

module.exports = { reportOf, fromWebhook, fromApi, fromApiCollection };
