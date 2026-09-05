const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../app');

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

test('the app asks for no connection, because it only receives deliveries', () => {
  assert.equal(app.authentication, undefined);
  assert.deepEqual(app.beforeRequest, []);
  assert.deepEqual(app.afterResponse, []);
});

test('nothing in the app calls the Session Replay API', () => {
  const fs = require('node:fs');
  const root = `${__dirname}/..`;
  const source = fs
    .readdirSync(root, { recursive: true })
    .filter((name) => name.endsWith('.js'))
    .filter((name) => !['test', 'node_modules', 'build'].some((skip) => name.startsWith(skip)))
    .map((name) => fs.readFileSync(`${root}/${name}`, 'utf8'))
    .join('\n');

  assert.doesNotMatch(source, /z\.request|\/api\/v1|Authorization/);
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
