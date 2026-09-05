const { triggerFor } = require('../lib/hook');
const { REPORT_STATUS_CHANGED } = require('../lib/events');

module.exports = triggerFor({
  key: 'report_status_changed',
  event: REPORT_STATUS_CHANGED,
  noun: 'Report',
  label: 'Report Status Changed',
  description: 'Triggers when somebody moves a report to a different status.'
});
