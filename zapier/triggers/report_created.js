const { triggerFor } = require('../lib/hook');
const { REPORT_CREATED } = require('../lib/events');

module.exports = triggerFor({
  key: 'report_created',
  event: REPORT_CREATED,
  noun: 'Report',
  label: 'New Bug Report',
  description: 'Triggers when a new report arrives for one of your domains.'
});
