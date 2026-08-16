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

export const TRIGGER_ATTRIBUTE = 'data-sr-trigger';

// Marks a document as already listening, so calling init() twice is harmless.
const LISTENER_FLAG = '__sessionReplayDelegated';

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

  const extension = await detectExtension({ win, ...options });

  if (!extension) {
    const supported = isSupportedBrowser({ nav });

    showSplash({ doc, supported });

    return supported ? 'missing' : 'unsupported';
  }

  const { opened, reason } = await requestPanel({ win });

  if (opened) return 'opened';

  // Logged, not shown. Whether Chrome will open a panel for a click that began in a page
  // is the question this feature turns on, and the answer belongs where a developer can
  // read it - the visitor only needs to be told what to do instead.
  if (reason && win.console) win.console.warn(`[session-replay] panel did not open: ${reason}`);

  // Chrome only lets an extension open its own panel in response to its own button being
  // pressed. Whether a click that started in the page counts has changed between Chrome
  // versions, so this path is a real outcome rather than a defensive branch, and it says
  // what to do instead rather than failing silently.
  showSplash({ doc, supported: true, message: null, ...blockedMessage() });

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
