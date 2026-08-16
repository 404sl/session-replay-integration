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

export const PING_EVENT = 'sessionreplay:ping';
export const PONG_EVENT = 'sessionreplay:pong';
export const OPEN_EVENT = 'sessionreplay:open-panel';
export const OPENED_EVENT = 'sessionreplay:panel-result';

// Long enough for a content script that is already running, short enough that nobody
// watching a button wonders whether they missed. The script is injected at document_start,
// so if it is going to answer it answers immediately.
export const PING_TIMEOUT_MS = 300;

/**
 * Ask the extension whether it is present on this page.
 *
 * @param {Object} [options]
 * @param {Window} [options.win] window to ask, for tests
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Object|null>} what the extension said about itself, or null
 */
export function detectExtension({ win = window, timeoutMs = PING_TIMEOUT_MS } = {}) {
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
export function isSupportedBrowser({ nav = navigator } = {}) {
  const brands = nav.userAgentData?.brands;

  if (Array.isArray(brands) && brands.length) {
    return brands.some(({ brand }) => /chromium|google chrome|microsoft edge|brave|opera/i.test(brand));
  }

  const ua = String(nav.userAgent || '');

  // Order matters: every Chromium user agent also contains "Safari".
  if (/edg\/|opr\/|chrome\//i.test(ua)) return true;

  return false;
}
