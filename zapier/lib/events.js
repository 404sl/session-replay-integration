const REPORT_CREATED = 'report.created';
const REPORT_STATUS_CHANGED = 'report.status_changed';
const REPORT_SEVERITY_CHANGED = 'report.severity_changed';
const REPORT_FIRST_VIEWED = 'report.first_viewed';
const REPORT_SENT = 'report.sent';

const ALL = [
  REPORT_CREATED,
  REPORT_STATUS_CHANGED,
  REPORT_SEVERITY_CHANGED,
  REPORT_FIRST_VIEWED,
  REPORT_SENT
];

const PAYLOAD_VERSION = 1;

module.exports = {
  REPORT_CREATED,
  REPORT_STATUS_CHANGED,
  REPORT_SEVERITY_CHANGED,
  REPORT_FIRST_VIEWED,
  REPORT_SENT,
  ALL,
  PAYLOAD_VERSION
};
