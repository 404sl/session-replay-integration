const reportCreated = require('./triggers/report_created');
const reportStatusChanged = require('./triggers/report_status_changed');
const reportSeverityChanged = require('./triggers/report_severity_changed');
const reportFirstViewed = require('./triggers/report_first_viewed');
const reportSent = require('./triggers/report_sent');
const teamList = require('./triggers/team_list');
const { authentication, addBearerHeader } = require('./lib/authentication');

const app = {
  authentication,
  beforeRequest: [addBearerHeader],
  afterResponse: [],
  triggers: {
    [reportCreated.key]: reportCreated,
    [reportStatusChanged.key]: reportStatusChanged,
    [reportSeverityChanged.key]: reportSeverityChanged,
    [reportFirstViewed.key]: reportFirstViewed,
    [reportSent.key]: reportSent,
    [teamList.key]: teamList
  },
  creates: {},
  searches: {},
  resources: {}
};

module.exports = app;
