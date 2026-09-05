const { triggerFor } = require('../lib/hook');
const { REPORT_FIRST_VIEWED } = require('../lib/events');

module.exports = triggerFor({
  key: 'report_first_viewed',
  event: REPORT_FIRST_VIEWED,
  noun: 'Report',
  label: 'Report First Viewed',
  description: 'Triggers when a report is opened for the first time.'
});
