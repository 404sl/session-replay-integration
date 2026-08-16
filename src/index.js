// Session Replay integration: a "report a bug" button for your own site.
//
// The button belongs on the page because that is where the bug is. Somebody who has just
// hit a problem should not have to know that a browser extension exists, find its icon, and
// work out that it applies to them - they should be able to press the thing that says
// "report a bug".
//
// What this does, in order:
//
//   1. asks the extension, on this page, whether it is there
//   2. if it is, asks it to open its panel
//   3. if it is not, explains what it is and where to get it
//
// It sends nothing anywhere. There is no network request in this library at all: no
// analytics, no beacon, no phone home. Everything it needs to decide is available in the
// page it is already running in, and a "report a bug" button that reported on its visitors
// would be a poor joke.

import { detectExtension, isSupportedBrowser, OPEN_EVENT, OPENED_EVENT } from './detect.js';
import { showSplash } from './splash.js';
import { renderPlaceholders } from './button.js';

export const TRIGGER_ATTRIBUTE = 'data-sr-trigger';

// Marks a document as already listening, so calling init() twice is harmless.
const LISTENER_FLAG = '__sessionReplayDelegated';

// Whether the extension answered last time we asked. Detection runs when init() does, so a
// press can go straight to asking for the panel rather than spending the gesture on a round
// trip first. Null until asked; false is a real answer.
let knownPresent = null;

// How long to wait for the panel to actually open before assuming Chrome refused. The
// extension answers either way; this is only for the case where nothing answers at all.
const OPEN_TIMEOUT_MS = 1500;

/**
 * Is the extension present on this page?
 *
 * Exposed because a site may want to render its own button only when the button would
 * work - though the splash exists so it does not have to.
 *
 * @returns {Promise<boolean>}
 */
export async function isAvailable(options = {}) {
  return Boolean(await detectExtension(options));
}

/**
 * Start a report: open the panel, or explain why it cannot.
 *
 * @param {Object} [options] window/document/navigator overrides, for tests
 * @returns {Promise<string>} what happened - 'opened', 'blocked', 'missing' or 'unsupported'
 */
export async function report(options = {}) {
  const { win = window, doc = document, nav = navigator } = options;

  // Asked before anything is awaited, when we already know the extension is there.
  //
  // The gesture is the point. sidePanel.open() needs the user activation Chrome forwards
  // from the click, and awaiting a round trip first spends it - the request would leave in
  // a later task, with the activation gone by the time the worker sees it. So detection
  // happens ahead of the press, and the press itself goes straight out.
  if (knownPresent) {
    const early = await requestPanel({ win });

    if (early.opened) return 'opened';

    return blocked(win, doc, early.reason);
  }

  const extension = await detectExtension({ win, ...options });

  knownPresent = Boolean(extension);

  if (!extension) {
    const supported = isSupportedBrowser({ nav });

    showSplash({ doc, supported });

    return supported ? 'missing' : 'unsupported';
  }

  const { opened, reason } = await requestPanel({ win });

  if (opened) return 'opened';

  return blocked(win, doc, reason);
}

// Everything that happens when the panel would not open. Reachable from two places now,
// because a press that already knew the extension was there skips detection entirely.
function blocked(win, doc, reason) {
  // Logged, not shown. The visitor needs to know what to do; whoever is integrating needs
  // to know which rule was hit, and the console is where they look.
  if (reason && win.console) win.console.warn(`[session-replay] panel did not open: ${reason}`);

  showSplash({ doc, supported: true, ...blockedMessage() });

  return 'blocked';
}

/**
 * Start listening for presses of any element carrying the trigger attribute.
 *
 * Safe to call more than once, and needs calling only once per document however many
 * triggers there are or when they appear.
 *
 * @returns {boolean} whether this call was the one that started listening
 */
export function init(options = {}) {
  // onTrigger exists so the delegation can be tested without the overlay and the extension
  // handshake coming with it. Everything else calls it with the default.
  const { doc = document, onTrigger = report } = options;

  // One listener on the document rather than one per element.
  //
  // Wiring elements individually breaks on any site that replaces its DOM - Turbo, React,
  // htmx - because the button that gets clicked is a different element from the one that
  // was wired, and it silently falls back to whatever the markup does on its own. Which
  // for the usual <a href="#"> is: navigate to #.
  //
  // Delegation also means a button rendered after this ran needs no second call.
  if (doc[LISTENER_FLAG]) return false;

  doc[LISTENER_FLAG] = true;

  // Fill any <div data-session-replay-button></div> the site wrote. Done here rather than
  // asked for separately, because a site that put the placeholder in its markup has already
  // said what it wants and should not also have to call something.
  renderPlaceholders({ doc });

  // Ahead of any press, so the press itself has nothing to wait for. Nobody is looking at
  // the result yet, and a page with no extension simply records that.
  const win = options.win || globalThis.window;

  if (win) {
    detectExtension({ ...options, win })
      .then((found) => {
        knownPresent = Boolean(found);
      })
      .catch(() => {
        knownPresent = false;
      });
  }

  // Capture phase, so this runs before frameworks that intercept clicks on the way up.
  // Turbo listens for clicks on the document and would otherwise start a visit to "#"
  // before preventDefault had been called on the way back down.
  doc.addEventListener(
    'click',
    (event) => {
      const trigger = event.target?.closest?.(`[${TRIGGER_ATTRIBUTE}]`);
      if (!trigger) return;

      event.preventDefault();
      onTrigger(options);
    },
    true
  );

  return true;
}

/**
 * Ask the extension to open its panel, and wait to hear whether it did.
 *
 * @returns {Promise<{opened: boolean, reason?: string}>}
 */
export function requestPanel({ win = window, timeoutMs = OPEN_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      win.removeEventListener(OPENED_EVENT, onResult);
      resolve(value);
    };

    const onResult = (event) =>
      finish({ opened: Boolean(event?.detail?.opened), reason: event?.detail?.reason });

    win.addEventListener(OPENED_EVENT, onResult);
    win.dispatchEvent(new win.CustomEvent(OPEN_EVENT));
    win.setTimeout(() => finish({ opened: false, reason: 'no answer' }), timeoutMs);
  });
}

function blockedMessage() {
  return {
    message:
      'Session Replay is installed. Open it from the toolbar - Chrome only lets an ' +
      'extension open its own panel from its own button.'
  };
}

export { showSplash, isSupportedBrowser, detectExtension };
