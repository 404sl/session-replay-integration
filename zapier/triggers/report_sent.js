const { triggerFor } = require('../lib/hook');
const { REPORT_SENT } = require('../lib/events');

module.exports = triggerFor({
  key: 'report_sent',
  event: REPORT_SENT,
  noun: 'Report',
  label: 'Report Sent',
  description: 'Triggers when somebody sends a report to this webhook by hand.'
});
