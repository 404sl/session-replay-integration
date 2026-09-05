const OUTPUT_FIELDS = [
  { key: 'id', label: 'Delivery ID' },
  { key: 'event', label: 'Event' },
  { key: 'version', label: 'Payload version', type: 'integer' },
  { key: 'sent_at', label: 'Sent at', type: 'datetime' },
  { key: 'report__id', label: 'Report ID' },
  { key: 'report__share_token', label: 'Share token' },
  { key: 'report__share_url', label: 'Share URL' },
  { key: 'report__status', label: 'Status' },
  { key: 'report__severity', label: 'Severity' },
  { key: 'report__created_at', label: 'Report created at', type: 'datetime' },
  { key: 'report__updated_at', label: 'Report updated at', type: 'datetime' },
  { key: 'site__id', label: 'Site ID' },
  { key: 'site__domain', label: 'Site domain' }
];

module.exports = { OUTPUT_FIELDS };
