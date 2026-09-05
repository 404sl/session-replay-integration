const { triggerFor } = require('../lib/hook');
const { REPORT_SEVERITY_CHANGED } = require('../lib/events');

module.exports = triggerFor({
  key: 'report_severity_changed',
  event: REPORT_SEVERITY_CHANGED,
  noun: 'Report',
  label: 'Report Severity Changed',
  description: 'Triggers when somebody changes how severe a report is.'
});
