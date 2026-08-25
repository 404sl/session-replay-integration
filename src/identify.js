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

// The keys are the site's to pick, the same way the sr-data- meta tags are - both routes
// end up in the same field on the report, so a fixed list here would only mean that one of
// the two ways to send something could send it. What is filtered is the shape, not the
// vocabulary.

// Bounds, matched to the server's own (OwnerContext::MAX_KEYS, MAX_KEY_LENGTH,
// MAX_VALUE_LENGTH) rather than invented here. This is politeness - the server cleans and
// bounds the merged hash whatever we do - so a page cannot fill a report with a thousand
// keys and find out only after the capture.
const MAX_KEYS = 20;
const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 1024;

/**
 * The name a value is filed under.
 *
 * Underscore, always, and the same transformation the extension already applies to the
 * context it asks us for - so a pushed key carries one name from the call through to the row
 * on the report, instead of `orderId` reaching a customer as "orderid" once the server has
 * dropped what it cannot keep. The API stays camelCase, which is what a caller writing
 * JavaScript expects; the stored name is spelled the way it will be read.
 *
 * A meta tag's name goes the same way once its `sr-data-` prefix is off, so the two routes
 * converge: `sr-data-order-id`, `sr-data-orderId` and `identify({ orderId })` all land on
 * `order_id`, and a site that uses both for one field gets one row rather than two
 * spellings of the same thing.
 *
 * @param {string} key as the page spelled it
 * @returns {string} the name the value is filed under
 */
function normaliseKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase()
    .slice(0, MAX_KEY_LENGTH);
}

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
 * @param {Object} values whatever the site correlates by - email, plan, release, an order
 *   number, a request id, anything else it would have put in a sr-data- meta tag
 * @param {Object} [options] window override, for tests
 * @returns {Object} the context as it now stands, under the names it is stored by
 */
export function identify(values, { win = globalThis.window } = {}) {
  if (values && typeof values === 'object') {
    Object.entries(values).forEach(([key, value]) => {
      const name = normaliseKey(key);

      if (!name || value === undefined) return;

      if (value === null) {
        delete pushedContext[name];
        return;
      }

      // Scalars, stored as text. Anything with a shape to it is refused here rather than
      // carried to a server that would drop it silently, and a report shows these as text
      // whatever they arrive as.
      if (typeof value === 'object' || typeof value === 'function') return;

      // A new key past the cap is dropped; one already held can still be corrected, so a
      // page that hits the ceiling keeps working rather than freezing what it last said.
      if (!(name in pushedContext) && Object.keys(pushedContext).length >= MAX_KEYS) return;

      pushedContext[name] = String(value).slice(0, MAX_VALUE_LENGTH);
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
