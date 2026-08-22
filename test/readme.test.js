import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

// Every script-tag example in the README is meant to be pasted onto a page that loads the
// library with `defer`, which is how the install section documents it. A snippet that calls
// window.SessionReplay straight from the markup therefore runs before the loader has, and
// throws on the first load of every page it lands on - in somebody else's site, where we
// never see it. So the snippet has to carry the wait itself.
//
// Which event it waits for is the snippet's business; that it waits at all is not.
test('every script-tag example waits for the loader before calling the global', () => {
  const blocks = readme.match(/<script>[\s\S]*?<\/script>/g) ?? [];
  const calling = blocks.filter((block) => block.includes('SessionReplay.'));

  assert.ok(calling.length > 0, 'no script-tag example calls the global any more');

  calling.forEach((block) => {
    const listener = block.indexOf('addEventListener');
    const call = block.indexOf('SessionReplay.');

    assert.notEqual(listener, -1, `runs before the loader exists:\n${block}`);
    assert.ok(listener < call, `calls the global outside the wait:\n${block}`);
  });
});

// The install snippets pin a version in the filename, and those URLs are frozen: the file
// 0.2.0 serves is the file it served the day it was published. So a README that documents a
// call the pinned bundle does not contain is broken in exactly the way a missing wait is -
// paste it, and it throws. This is how `identify()` came to be documented under a pin that
// predates it.
test('the pinned install URLs name the version this package ships', async () => {
  const { version } = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  );

  const pins = [...readme.matchAll(/session-replay-(\d+\.\d+\.\d+)\.(?:js|css)/g)];

  assert.ok(pins.length > 0, 'no example pins a version any more');

  pins.forEach(([url, pinned]) => {
    assert.equal(pinned, version, `${url} is behind package.json (${version})`);
  });
});
