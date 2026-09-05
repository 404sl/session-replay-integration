const { version: platformVersion } = require('zapier-platform-core');

const app = require('./app');
const { version } = require('./package.json');

module.exports = { ...app, version, platformVersion };
