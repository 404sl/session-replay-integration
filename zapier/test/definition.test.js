const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../app');
const { authentication } = require('../authentication');

const optional = (name) => {
  try {
    return require(name);
  } catch {
    return null;
  }
};

const validator = optional('zapier-platform-core/src/tools/schema');
const core = optional('zapier-platform-core');
const installed = validator && core ? false : 'the Zapier platform packages are not installed';

test('the app authenticates with a key rather than an OAuth handshake', () => {
  assert.equal(app.authentication.type, 'custom');
  assert.equal(app.authentication, authentication);
  assert.equal(typeof app.authentication.test, 'function');
});

test('every trigger is an inbound hook rather than a poll of our own API', () => {
  Object.entries(app.triggers).forEach(([key, trigger]) => {
    assert.equal(trigger.key, key);
    assert.equal(trigger.operation.type, 'hook');
    assert.equal(typeof trigger.operation.perform, 'function');
    assert.equal(typeof trigger.operation.performList, 'function');
    assert.ok(trigger.display.label);
    assert.ok(trigger.display.description.endsWith('.'));
    assert.ok(trigger.noun);
  });
});

test('the app offers no actions, because it only listens', () => {
  assert.deepEqual(app.creates, {});
  assert.deepEqual(app.searches, {});
});

test('the definition Zapier is pushed satisfies its own validator', { skip: installed }, () => {
  const definition = require('../index');

  assert.equal(definition.version, require('../package.json').version);
  assert.equal(definition.platformVersion, core.version);
  assert.deepEqual(validator.validateApp(definition), []);
});
