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

const appSource = (except = []) => {
  const fs = require('node:fs');
  const root = `${__dirname}/..`;

  return fs
    .readdirSync(root, { recursive: true })
    .filter((name) => name.endsWith('.js'))
    .filter((name) => !['test', 'node_modules', 'build'].some((skip) => name.startsWith(skip)))
    .filter((name) => !except.includes(name))
    .map((name) => fs.readFileSync(`${root}/${name}`, 'utf8'))
    .join('\n');
};

test('nothing outside the subscribe pair calls the Session Replay API', () => {
  assert.doesNotMatch(appSource(['lib/hook.js']), /z\.request|\/api\/v1|Authorization/);
});

test('the subscribe pair calls the destinations endpoint and the teams it offers, nothing else', () => {
  const source = appSource().match(/\/api\/v1[\w/]*/g) ?? [];

  assert.deepEqual([...new Set(source)].sort(), ['/api/v1/teams', '/api/v1/webhook_destinations']);
});

test('every trigger a Zap can pick is an inbound hook rather than a poll of our own API', () => {
  Object.entries(app.triggers).filter(([, trigger]) => !trigger.display.hidden).forEach(([key, trigger]) => {
    assert.equal(trigger.key, key);
    assert.equal(trigger.operation.type, 'hook');
    assert.equal(typeof trigger.operation.perform, 'function');
    assert.equal(typeof trigger.operation.performList, 'function');
    assert.equal(typeof trigger.operation.performSubscribe, 'function');
    assert.equal(typeof trigger.operation.performUnsubscribe, 'function');
    assert.ok(trigger.display.label);
    assert.ok(trigger.display.description.endsWith('.'));
    assert.ok(trigger.noun);
  });
});

test('the only trigger that polls our API is the hidden one behind the team field', () => {
  const polling = Object.values(app.triggers).filter((trigger) => trigger.operation.type !== 'hook');

  assert.deepEqual(polling.map((trigger) => trigger.key), ['teamList']);
  assert.equal(app.triggers.teamList.display.hidden, true);
  assert.equal(typeof app.triggers.teamList.operation.perform, 'function');
});

test('the team field names the trigger that fills it', () => {
  Object.values(app.triggers)
    .filter((trigger) => trigger.operation.type === 'hook')
    .forEach((trigger) => {
      const team = trigger.operation.inputFields.find((field) => field.key === 'team_id');

      assert.equal(team.dynamic, `${app.triggers.teamList.key}.id.name`);
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
