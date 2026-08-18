// What the site tells us about whoever is looking at the page - and nothing it did not.
//
// A report is far more useful when it says which account hit the problem and which release
// they were on, and the page already knows both. The tempting way to get them is to go and
// look: read the email out of the header, guess the plan from a badge. That is what this
// file exists to refuse. Reading somebody else's page to guess at their user's email is a
// privacy liability, it breaks on their next redesign, and it does not survive a security
// review. So the site pushes what it wants us to have, and we hold it until we are asked.
//
// Held on the page and sent nowhere - there is no network request here any more than
// anywhere else in this library. The values leave only in answer to a CustomEvent from the
// extension's content script, over the same request/answer idiom as the ping/pong in
// detect.js.

export const CONTEXT_REQUEST_EVENT = 'sessionreplay:context-request';
export const CONTEXT_EVENT = 'sessionreplay:context';

// The whole vocabulary. A site that wants to hand over something else is asking for a
// free-form blob, and a blob is what the meta tag this replaces carried: nothing can
// validate it, filter it, or show it sensibly on a report.
export const CONTEXT_KEYS = ['email', 'plan', 'orderId', 'release', 'requestId'];

// Marks a window as already answering, so identify() called on every route change of an SPA
// leaves one listener rather than one per call, all answering the same question.
const CONTEXT_LISTENER_FLAG = '__sessionReplayContext';

let pushedContext = {};

/**
 * Hand over who this is, for whenever a report is made.
 *
 * Merges with what was given before, so a page can add to it as it learns more rather than
 * repeating everything on every call. A key given as `null` is dropped, which is what a
 * sign-out wants; a key left out is left alone.
 *
 * @param {Object} values any subset of email, plan, orderId, release and requestId
 * @param {Object} [options] window override, for tests
 * @returns {Object} the context as it now stands
 */
export function identify(values, { win = globalThis.window } = {}) {
  if (values && typeof values === 'object') {
    CONTEXT_KEYS.forEach((key) => {
      const value = values[key];

      if (value === undefined) return;

      if (value === null) {
        delete pushedContext[key];
        return;
      }

      // Scalars, stored as text. Anything with a shape to it would be the unstructured blob
      // again, and a report shows these as text whatever they arrive as.
      if (typeof value === 'object' || typeof value === 'function') return;

      pushedContext[key] = String(value);
    });
  }

  if (win) answerContextRequests({ win });

  return getContext();
}

/**
 * The context as it stands, as a copy - so a caller holding it cannot edit ours.
 *
 * @returns {Object}
 */
export function getContext() {
  return { ...pushedContext };
}

/**
 * Forget everything that was pushed.
 *
 * @returns {void}
 */
export function clearContext() {
  pushedContext = {};
}

/**
 * Start answering the extension when it asks for the context.
 *
 * Installed by identify() rather than by init(), so a page that has never pushed anything
 * stays silent instead of answering with an empty object. Silence is what having no library
 * at all sounds like, and there is nothing to say.
 *
 * @param {Object} [options]
 * @param {Window} [options.win] window to answer on, for tests
 * @returns {boolean} whether this call was the one that started listening
 */
export function answerContextRequests({ win = window } = {}) {
  if (win[CONTEXT_LISTENER_FLAG]) return false;

  win[CONTEXT_LISTENER_FLAG] = true;

  win.addEventListener(CONTEXT_REQUEST_EVENT, () => {
    win.dispatchEvent(new win.CustomEvent(CONTEXT_EVENT, { detail: { context: getContext() } }));
  });

  return true;
}
