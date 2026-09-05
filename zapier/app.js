const { authentication, includeBearer } = require('./authentication');
const reportCreated = require('./triggers/report_created');
const reportStatusChanged = require('./triggers/report_status_changed');
const reportSeverityChanged = require('./triggers/report_severity_changed');
const reportFirstViewed = require('./triggers/report_first_viewed');
const reportSent = require('./triggers/report_sent');

const app = {
  authentication,
  beforeRequest: [includeBearer],
  afterResponse: [],
  triggers: {
    [reportCreated.key]: reportCreated,
    [reportStatusChanged.key]: reportStatusChanged,
    [reportSeverityChanged.key]: reportSeverityChanged,
    [reportFirstViewed.key]: reportFirstViewed,
    [reportSent.key]: reportSent
  },
  creates: {},
  searches: {},
  resources: {}
};

module.exports = app;
