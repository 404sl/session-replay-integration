/**
 * Session Replay integration
 * https://github.com/404sl/session-replay-integration
 *
 * Adds a "report a bug" button to your own pages. Opens the Session Replay extension when
 * it is installed, and explains where to get it when it is not.
 *
 * Sends nothing anywhere: there is no network request in this file.
 *
 * MIT licensed.
 */
(function () {
  'use strict';

// Is the extension here, and can this browser run it at all?
//
// Detection is a question asked of the page, not of the network. The extension already
// injects a content script into every page at document_start; this asks that script to say
// hello and waits briefly for an answer.
//
// A CustomEvent rather than chrome.runtime.sendMessage with an extension id: that would
// need every customer domain listed in the extension's manifest under
// externally_connectable, and the wildcard version of it would let any site on the internet
// probe whether a visitor has the extension installed. This channel only answers pages that
// deliberately load this library.

const PING_EVENT = 'sessionreplay:ping';
const PONG_EVENT = 'sessionreplay:pong';
const OPEN_EVENT = 'sessionreplay:open-panel';
const OPENED_EVENT = 'sessionreplay:panel-result';

// Long enough for a content script that is already running, short enough that nobody
// watching a button wonders whether they missed. The script is injected at document_start,
// so if it is going to answer it answers immediately.
const PING_TIMEOUT_MS = 300;

/**
 * Ask the extension whether it is present on this page.
 *
 * @param {Object} [options]
 * @param {Window} [options.win] window to ask, for tests
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Object|null>} what the extension said about itself, or null
 */
function detectExtension({ win = window, timeoutMs = PING_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      win.removeEventListener(PONG_EVENT, onPong);
      resolve(value);
    };

    const onPong = (event) => finish(event?.detail || {});

    win.addEventListener(PONG_EVENT, onPong);
    win.dispatchEvent(new win.CustomEvent(PING_EVENT));

    // The content script answers synchronously, so a reply has usually arrived before
    // dispatchEvent even returns. The timer is for the case where nothing is listening.
    win.setTimeout(() => finish(null), timeoutMs);
  });
}

/**
 * Could this browser run the extension, whether or not it currently does?
 *
 * Chromium only - it is a Chrome extension. Told apart by the brand list where the browser
 * offers one, and by the user agent where it does not, because Safari and Firefox never
 * expose userAgentData at all and would otherwise read as "no brands, so maybe".
 *
 * @param {Object} [options]
 * @param {Navigator} [options.nav]
 * @returns {boolean}
 */
function isSupportedBrowser({ nav = navigator } = {}) {
  const brands = nav.userAgentData?.brands;

  if (Array.isArray(brands) && brands.length) {
    return brands.some(({ brand }) => /chromium|google chrome|microsoft edge|brave|opera/i.test(brand));
  }

  const ua = String(nav.userAgent || '');

  // Order matters: every Chromium user agent also contains "Safari".
  if (/edg\/|opr\/|chrome\//i.test(ua)) return true;

  return false;
}

// What somebody sees when they press the button without the extension.
//
// Drawn here rather than opened as a new tab: pressing "report a bug" and being navigated
// away from the bug is a poor trade, and the page they were on is the thing they wanted to
// report about.
//
// Styles are inline on the elements rather than in a stylesheet. This runs inside somebody
// else's page, where our class names are not ours and their reset may be anything, and a
// stylesheet of our own would be one more thing for their CSP to refuse.

const STORE_URL =
  'https://chromewebstore.google.com/detail/cpcncaaklnlebendcdejmhaoojoobfnl';

const COPY = {
  title:        'Report this bug with one click',
  supported:
    'Session Replay is a Chrome extension. It captures what you see, along with the ' +
    'console output, the network log and what the page was doing - so the people fixing ' +
    'it do not have to ask.',
  unsupported:
    'Session Replay is a Chrome extension, and this browser cannot run it. Open this page ' +
    'in Chrome, Edge, Brave or another Chromium browser to report a bug this way.',
  install:      'Get the extension',
  dismiss:      'Not now',
  panelBlocked:
    'Session Replay is installed. Open it from the toolbar - Chrome only lets an extension ' +
    'open its own panel from its own button.'
};

/**
 * Show the overlay.
 *
 * @param {Object} options
 * @param {Document} [options.doc]
 * @param {boolean} options.supported whether this browser could run the extension
 * @param {string} [options.message] replaces the body, for the panel-blocked case
 * @returns {Function} closes it
 */
function showSplash({ doc = document, supported = true, message = null } = {}) {
  const overlay = element(doc, 'div', {
    position: 'fixed',
    inset: '0',
    // Above almost anything, without reaching for the maximum and starting an arms race
    // with the host page's own overlays.
    zIndex: '2147483000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15, 23, 25, 0.55)',
    // The host page's font, deliberately: this is their page and it should not look like
    // an advert that wandered in.
    font: '14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif'
  });

  const card = element(doc, 'div', {
    background: '#fff',
    color: '#212529',
    maxWidth: '26rem',
    width: 'calc(100% - 2rem)',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    boxShadow: '0 1.5rem 3rem rgba(0,0,0,0.25)',
    textAlign: 'left'
  });

  const close = () => overlay.remove();

  const heading = element(doc, 'h2', {
    margin: '0 0 0.5rem',
    fontSize: '1.05rem',
    fontWeight: '600'
  });
  heading.textContent = COPY.title;

  const body = element(doc, 'p', { margin: '0 0 1.25rem', color: '#495057' });
  body.textContent = message || (supported ? COPY.supported : COPY.unsupported);

  const actions = element(doc, 'div', { display: 'flex', gap: '0.5rem', alignItems: 'center' });

  // No install button in a browser that cannot install it, and none when the extension is
  // already there and merely could not open its own panel.
  if (supported && !message) {
    const install = element(doc, 'a', {
      background: '#047857',
      color: '#fff',
      padding: '0.5rem 0.9rem',
      borderRadius: '0.4rem',
      textDecoration: 'none',
      fontWeight: '600'
    });
    install.href = STORE_URL;
    install.target = '_blank';
    install.rel = 'noopener noreferrer';
    install.textContent = COPY.install;
    actions.appendChild(install);
  }

  const dismiss = element(doc, 'button', {
    background: 'transparent',
    border: '0',
    color: '#6c757d',
    padding: '0.5rem',
    cursor: 'pointer',
    font: 'inherit'
  });
  dismiss.type = 'button';
  dismiss.textContent = COPY.dismiss;
  dismiss.addEventListener('click', close);
  actions.appendChild(dismiss);

  card.append(heading, body, actions);
  overlay.appendChild(card);

  // Clicking the backdrop closes; clicking the card does not.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  doc.body.appendChild(overlay);
  dismiss.focus();

  return close;
}


function element(doc, tag, styles) {
  const node = doc.createElement(tag);

  Object.assign(node.style, styles);

  return node;
}

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



const TRIGGER_ATTRIBUTE = 'data-sr-trigger';

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
async function isAvailable(options = {}) {
  return Boolean(await detectExtension(options));
}

/**
 * Start a report: open the panel, or explain why it cannot.
 *
 * @param {Object} [options] window/document/navigator overrides, for tests
 * @returns {Promise<string>} what happened - 'opened', 'blocked', 'missing' or 'unsupported'
 */
async function report(options = {}) {
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
 * Wire every element carrying the trigger attribute.
 *
 * Idempotent: elements added later can be wired by calling this again, and an element that
 * has already been wired is skipped rather than given a second handler.
 *
 * @returns {number} how many were newly wired
 */
function init(options = {}) {
  const { doc = document } = options;
  const wiredFlag = '__sessionReplayWired';
  let wired = 0;

  doc.querySelectorAll(`[${TRIGGER_ATTRIBUTE}]`).forEach((node) => {
    if (node[wiredFlag]) return;

    node[wiredFlag] = true;
    node.addEventListener('click', (event) => {
      event.preventDefault();
      report(options);
    });
    wired += 1;
  });

  return wired;
}

/**
 * Ask the extension to open its panel, and wait to hear whether it did.
 *
 * @returns {Promise<{opened: boolean, reason?: string}>}
 */
function requestPanel({ win = window, timeoutMs = OPEN_TIMEOUT_MS } = {}) {
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

  // The script tag path wires itself. The npm package does not - importing a module should
  // not reach into the document on its own, and a bundler user calls init() when ready.
  function autoInit() {
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // For pages that render their button later, or want to trigger a report from their own
  // code without an element at all.
  window.SessionReplay = Object.assign(window.SessionReplay || {}, {
    report,
    init,
    isAvailable
  });
}());
