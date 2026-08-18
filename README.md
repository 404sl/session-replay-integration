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
<script src="https://session-replay.com/integration/session-replay-0.2.0.js" defer></script>

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
  <script src="https://session-replay.com/integration/session-replay-0.2.0.js" defer></script>
</head>
...
<div data-session-replay-button></div>
```

## Or write the markup yourself

If you would rather the button were in your own HTML than added to it by a script - so it is
in your source, in your server's response, and there before any JavaScript runs - load the
stylesheet and write the four lines:

```html
<head>
  <link rel="stylesheet" href="https://session-replay.com/integration/session-replay-0.2.0.css">
  <script src="https://session-replay.com/integration/session-replay-0.2.0.js" defer></script>
</head>
...
<div class="sr-report">
  <button type="button" data-sr-trigger class="sr-report-trigger">
    <span class="sr-report-label">Report a bug</span>
  </button>
  <small class="sr-report-by">Powered by
    <a class="sr-report-link" href="https://session-replay.com/?utm_source=integration&utm_medium=button"
       target="_blank" rel="noopener">Session Replay</a></small>
</div>
```

The script still has to load - it is what talks to the extension - but it only wires the
click. Both paths produce the same button; the stylesheet is generated from the same file the
inline styles come from, so they cannot drift apart.

The stylesheet covers the button where you put it. The floating one stays a JavaScript call,
because pinning something to the corner of a page is a decision rather than a default.

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
<script src="https://session-replay.com/integration/session-replay-0.2.0.js" defer></script>
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

## The "Powered by" line

The branded button credits us underneath itself, with a link to the site. That is how people
find out this exists, and it is the deal for the button being free to use.

It is a sibling of the button, never inside it: an `<a>` inside a `<button>` is interactive
content nested in interactive content, which the HTML spec forbids and browsers handle
inconsistently - usually by making the link unreachable from the keyboard.

Turn it off with `attribution: false`:

```js
mountButton({ attribution: false });
```

Removing it is a **Professional** plan feature. This library cannot check that: it is open
source, it runs on your visitor's machine, and it makes no network request - so the option is
here for everyone and the plan is between us and you. Sites on Starter that keep the credit
are the reason the button exists at all.

Styling your own trigger removes it too, since then none of this markup is ours:

```html
<button data-sr-trigger>Something went wrong?</button>
```

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
import { report, isAvailable, init, identify } from '@404sl/session-replay-integration';

await isAvailable();  // is the extension on this page?
await report();       // 'opened' | 'blocked' | 'missing' | 'unsupported'
init();               // listen, and fill placeholders; safe to call again
identify({ email });  // who this is, for whenever a report is made
```

```js
import { renderPlaceholders, mountButton, createButton } from '@404sl/session-replay-integration/button';

renderPlaceholders(); // fill placeholders rendered since, on their own
mountButton();        // our floating button, if you want one
createButton();       // the element on its own, to place yourself
```

The three that build a button live behind `/button`, so importing `init` does not pull the
button code into your bundle when you have styled your own trigger. In the script-tag build
they are all on `window.SessionReplay`, where there is only one file to load anyway.

`report()` is there for sites that would rather trigger from their own code — a menu item,
a keyboard shortcut, an error boundary — than from an element attribute.

### `'blocked'`

Chrome only lets an extension open its own side panel in response to a user gesture, and
whether a click that began in the page still counts has changed between Chrome versions.
When the panel refuses to open, `report()` returns `'blocked'` and the overlay tells the
visitor to open it from the toolbar instead. It is a real outcome, not a defensive branch.

## Who hit the bug

A report is worth a great deal more when it says which account made it and which release
they were on. Your page knows both; tell us with `identify()`:

```js
import { identify } from '@404sl/session-replay-integration';

identify({
  email: 'ada@example.com',
  plan: 'professional',
  orderId: 'SR-1201',
  release: '2026.08.18',
  requestId: 'b1f4c0'
});
```

```html
<script>
  SessionReplay.identify({ email: 'ada@example.com', release: '2026.08.18' });
</script>
```

Those five keys, and no others:

| Key | What it is for |
| --- | --- |
| `email` | who is signed in, so a reply can go to them |
| `plan` | what they are paying for, known before the reply is written |
| `orderId` | the record the bug is about |
| `release` | the build the page came from |
| `requestId` | the server request that rendered it, to join to your own logs |

Pass any subset. Repeat calls **merge**, so a single-page app can add to it as it learns
more — sign-in, then a route change — rather than repeating everything each time. A key
given as `null` is dropped, which is what a sign-out wants. Anything outside the five is
ignored, and so is any value that is not a plain scalar: there is no free-form blob here,
because nothing could validate one or show it sensibly on a report.

**We never go looking for any of it.** The library reads nothing out of your DOM — no
scraping a header for an email, no guessing a plan from a badge. It holds what you pushed
and hands it over only when the extension asks for it, over the same `CustomEvent` question
and answer that detection uses. A page that never calls `identify()` says nothing at all,
and calling it never starts a recording: capturing stays something your visitor does, on
purpose, by pressing the button.

## Content Security Policy

The script-tag build needs `script-src https://session-replay.com`. The overlay styles
elements inline rather than shipping a stylesheet, so no `style-src` entry is required for
a stylesheet — though a policy without `'unsafe-inline'` for styles will need
`style-src-attr 'unsafe-inline'`.

If your policy will not allow a third-party script at all, install from npm and bundle it
with your own code.

## It speaks the page's language

The overlay reads `document.documentElement.lang` and answers in it — English, Russian,
German, Spanish, French, Italian or Portuguese, falling back to English for anything else.
A region tag like `pt-BR` is read as its base language.

The **page** is asked rather than the browser. `navigator.language` is what the reader
prefers, which is a different question, and answering it would have the overlay disagree
with the paragraph next to it.

So set `lang` on your `<html>` — worth doing regardless, since screen readers and
hyphenation need it too.

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
