# Session Replay integration

A **"Report a bug"** button for your own site.

Somebody who has just hit a problem should not have to know that a browser extension
exists, find its icon in a toolbar, and work out that it applies to them. They should be
able to press the thing that says *report a bug*.

That is all this does. It opens the [Session Replay][site] extension when the visitor has
it, and explains where to get it when they do not.

## Install

### A script tag

```html
<script src="https://session-replay.com/integration/session-replay-0.1.0.js" defer></script>

<button data-sr-trigger>Report a bug</button>
```

Any element with `data-sr-trigger` becomes a trigger. Style it however you like — this
library never touches how your button looks. That is the path for a site that wants its own
design; the placeholder above is the path for a site that wants none.

### npm

```sh
npm install @404sl/session-replay-integration
```

```js
import { init } from '@404sl/session-replay-integration';

init(); // wires every [data-sr-trigger] on the page
```

Importing the module does **not** wire anything on its own. A module that reached into the
document when imported would be a poor citizen of somebody else's build; call `init()` when
your app is ready. The script-tag build above wires itself, because that is what a script
tag is for.

## The short version

Write one empty element. The button that appears is ours - mark, wording, colours and
states - and you make no styling decisions at all:

```html
<head>
  <script src="https://session-replay.com/integration/session-replay-0.1.0.js" defer></script>
</head>
...
<div data-session-replay-button></div>
```

**In the head, with `defer`.** In the head so it is fetched while the page is still
parsing rather than after it; `defer` so it does not block that parsing and runs once the
elements it fills exist. It works from the end of the body too — it waits for
`DOMContentLoaded` when it has to — but the head is a page-load faster.

**The version is in the filename**, so the URL you install never changes contents and is
cached indefinitely. Taking a new version is a deliberate edit, not something that happens
to you overnight.

Give the attribute a corner name and it floats there instead:

```html
<div data-session-replay-button="bottom-right"></div>
```

## A button, if you want ours

Style your own trigger, or take a floating one:

```html
<script src="https://session-replay.com/integration/session-replay-0.1.0.js" defer></script>
<script>
  addEventListener('load', () => SessionReplay.mountButton());
</script>
```

```js
import { mountButton } from '@404sl/session-replay-integration/button';

const { remove } = mountButton({ position: 'bottom-left' });
```

`position` is `bottom-right` (default), `bottom-left`, `top-right` or `top-left`. It carries
`data-sr-trigger` itself, so nothing else needs wiring, and it shrinks to a circle on narrow
screens.

Nothing mounts it for you. A script tag that put a floating button on somebody's page
uninvited would be an advert rather than an integration.

## What happens when it is pressed

1. It asks the extension, on this page, whether it is there.
2. If it is, the extension opens its panel and the visitor captures the bug.
3. If it is not, an overlay explains what it is and links to the Chrome Web Store.
4. If the browser could never run it — Safari, Firefox — the overlay says so instead of
   offering an install that would not work.

## It sends nothing anywhere

There is no network request in this library. No analytics, no beacon, no phone home, no
cookie. Everything it needs is already in the page it is running in.

Detection is a question asked of the page, not of us: the extension's content script
answers a `CustomEvent`. It is deliberately **not** done with `externally_connectable`
messaging, because the wildcard form of that would let any site on the internet probe
whether a visitor has the extension installed. This channel only answers pages that have
chosen to load this library.

## API

```js
import { report, isAvailable, init } from '@404sl/session-replay-integration';

await isAvailable();  // is the extension on this page?
await report();       // 'opened' | 'blocked' | 'missing' | 'unsupported'
init();               // listen, and fill placeholders; safe to call again
renderPlaceholders(); // fill placeholders rendered since, on their own
mountButton();        // our floating button, if you want one
createButton();       // the element on its own, to place yourself
```

`report()` is there for sites that would rather trigger from their own code — a menu item,
a keyboard shortcut, an error boundary — than from an element attribute.

### `'blocked'`

Chrome only lets an extension open its own side panel in response to a user gesture, and
whether a click that began in the page still counts has changed between Chrome versions.
When the panel refuses to open, `report()` returns `'blocked'` and the overlay tells the
visitor to open it from the toolbar instead. It is a real outcome, not a defensive branch.

## Content Security Policy

The script-tag build needs `script-src https://session-replay.com`. The overlay styles
elements inline rather than shipping a stylesheet, so no `style-src` entry is required for
a stylesheet — though a policy without `'unsafe-inline'` for styles will need
`style-src-attr 'unsafe-inline'`.

If your policy will not allow a third-party script at all, install from npm and bundle it
with your own code.

## Browser support

Chromium browsers — Chrome, Edge, Brave, Opera, Arc. The extension is a Chrome extension;
this library detects the rest and says so plainly rather than offering an install that
cannot work.

## Development

```sh
npm test     # node's own test runner, no dependencies
npm run build  # produces dist/session-replay.js
```

There are no dependencies, and there is no bundler. This is a small amount of code that
goes on other people's pages, and every dependency it took on would be one they took on
too.

## Licence

MIT. See [LICENSE](LICENSE).

[site]: https://session-replay.com
