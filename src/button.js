// An optional floating "Report a bug" button.
//
// Sites style their own trigger, and most should: a button that matches the page it sits on
// is better than one that matches ours. This is for the case where somebody wants the
// feature and does not want to design a button for it - a good default they opt into, never
// something this library puts on a page by itself.
//
// It carries the trigger attribute and nothing else, so the delegated listener that init()
// already installed picks it up with no further wiring. There is no import from index.js in
// this file, deliberately: mounting a button should not drag in the extension handshake, and
// a site that only wants the element can have just the element.
//
// Styles are inline, for the same reason as in splash.js - this is somebody else's page and
// our class names are not ours there. Without a stylesheet there are no pseudo-classes and
// no media queries either, so hover and focus are listeners that repaint inline styles, and
// the narrow-screen layout is a matchMedia query rather than an @media block.
//
// The names in here are deliberately not the names splash.js uses for the same ideas. The
// script-tag build concatenates the source files into one scope, so a second `element` or a
// second `COLOR` would be a redeclaration rather than a private helper.

import {
  ATTRIBUTION_NAME,
  ATTRIBUTION_PREFIX,
  ATTRIBUTION_URL,
  BUTTON_CLASS,
  BUTTON_COLOR,
  BUTTON_Z_INDEX,
  MARK_BRACKETS,
  MARK_TRIANGLE,
  attributionStyle,
  compactTriggerStyle,
  labelStyle,
  linkStyle,
  rootStyle,
  triggerStates,
  triggerStyle
} from './styles.js';

const BUTTON_SVG_NS = 'http://www.w3.org/2000/svg';

const BUTTON_LABEL = 'Report a bug';

// Which corner, and which two offsets that corner needs. Anything else falls back to the
// bottom right, where a floating action button has meant "help" for a decade.
const BUTTON_POSITIONS = {
  'bottom-right': ['bottom', 'right'],
  'bottom-left':  ['bottom', 'left'],
  'top-right':    ['top', 'right'],
  'top-left':     ['top', 'left']
};

// Below this the label is dropped and the button becomes a mark in a circle. A pill wide
// enough to read is also wide enough to sit on top of whatever the page put in that corner,
// and on a phone that corner is usually the important one.
const BUTTON_COMPACT_QUERY = '(max-width: 30rem)';

/**
 * Build the floating button.
 *
 * Returns the element without putting it anywhere, so it can be placed in a container of
 * the site's choosing - a footer, a shadow root, a portal - rather than on the body.
 *
 * With attribution on - the default - what comes back is a wrapper holding the trigger and
 * a "Powered by Session Replay" line. The link is a sibling of the button rather than
 * inside it: an <a> inside a <button> is interactive content nested in interactive content,
 * which the HTML spec forbids and browsers disagree about. Where they disagree it is the
 * link that loses - unreachable by keyboard, or a click that fires the trigger as well.
 *
 * @param {Object} [options]
 * @param {Document} [options.doc]
 * @param {string} [options.position] bottom-right, bottom-left, top-right or top-left
 * @param {string} [options.label] what it says, and what a screen reader announces
 * @param {string} [options.offset] distance from the two edges it is pinned to
 * @param {string} [options.zIndex]
 * @param {boolean|string} [options.compact] true, false, or 'auto' to follow the viewport
 * @param {boolean} [options.inline] sit in the flow where it is placed, rather than pinned
 *   to a corner - which is what a site gets when it writes an empty
 *   <div data-session-replay-button></div> and lets us fill it
 * @param {boolean} [options.attribution] show the "Powered by" line. On by default. This
 *   library cannot check anybody's plan - it is open source, it runs on the visitor's
 *   machine and it makes no network request - so this is an honesty setting, not a lock.
 * @returns {HTMLElement} the wrapper, or the button itself when attribution is off
 */
export function createButton(options = {}) {
  const {
    doc = document,
    position: asked = 'bottom-right',
    label = BUTTON_LABEL,
    offset = '1.25rem',
    zIndex = BUTTON_Z_INDEX,
    compact = 'auto',
    inline = false,
    attribution = true
  } = options;

  // A position we do not recognise is a typo, and a typo should still produce a button.
  const position = BUTTON_POSITIONS[asked] ? asked : 'bottom-right';

  const motion = motionAllowed(doc);
  // The trigger's own look, from the file the stylesheet is generated from, so a pasted
  // snippet and a mounted button cannot end up looking like two different products.
  const base = triggerStyle({ inline, motion });

  const button = doc.createElement('button');

  Object.assign(button.style, base);

  button.type = 'button';
  button.className = BUTTON_CLASS.trigger;
  button.setAttribute('data-sr-trigger', '');
  // The name stays on the element even when the visible label is dropped on a narrow
  // screen, so the button never becomes an unnamed circle.
  button.setAttribute('aria-label', label);
  button.title = label;

  const text = doc.createElement('span');

  Object.assign(text.style, labelStyle());
  text.className = BUTTON_CLASS.label;
  text.textContent = label;

  // A white tile: the brackets and the play triangle are cut out of the mark, so the
  // button's own emerald shows through them.
  button.append(brandMark(doc, 20, BUTTON_COLOR.ink), text);
  // Tells the stylesheet not to add its own: a page that loads both files would otherwise
  // show this mark next to the one the CSS draws.
  button.setAttribute('data-sr-mark', 'svg');

  const states = triggerStates({ motion });

  paintStates(button, { base, hover: states.hover, active: states.active, focus: states.focus });

  applyCompact(button, text, compact === true);

  // Without attribution the button is the whole thing, and it carries the handle and the
  // corner itself - which is what it did before this option existed.
  if (!attribution) {
    button.setAttribute('data-session-replay-button', inline ? 'inline' : position);
    pin(button, { inline, position, offset, zIndex });

    if (compact === 'auto') watchWidth(doc, button, text, null);

    return button;
  }

  const root = doc.createElement('div');

  Object.assign(root.style, rootStyle({ inline }));
  if (!inline) root.style.zIndex = String(zIndex);
  root.className = BUTTON_CLASS.root;
  // Ours to find again, and a hook for a site that wants to move it without keeping the
  // handle we returned. On the wrapper now, so removing the handle removes the line too.
  root.setAttribute('data-session-replay-button', inline ? 'inline' : position);

  pin(root, { inline, position, offset, zIndex });

  const credit = doc.createElement('small');

  Object.assign(credit.style, attributionStyle());
  credit.className = BUTTON_CLASS.attribution;

  const link = doc.createElement('a');

  Object.assign(link.style, linkStyle());
  link.className = BUTTON_CLASS.link;
  link.href = ATTRIBUTION_URL;
  link.textContent = ATTRIBUTION_NAME;
  // A link out of somebody else's page opens in a tab of its own: a visitor who was halfway
  // through reporting a bug should not lose the page they were reporting it about. noopener
  // because target="_blank" without it hands us a handle on their window.
  link.target = '_blank';
  link.rel = 'noopener';

  credit.append(doc.createTextNode(ATTRIBUTION_PREFIX), link);
  root.append(button, credit);

  // The credit hides with the label when the button shrinks to a circle - a line of small
  // print is wider than the circle it would sit under.
  if (compact === true) credit.style.display = 'none';
  if (compact === 'auto') watchWidth(doc, button, text, credit);

  return root;
}

/**
 * Build the button and put it on the page.
 *
 * @param {Object} [options] everything createButton takes
 * @returns {{element: HTMLButtonElement, remove: Function}}
 */
export function mountButton(options = {}) {
  const { doc = document } = options;
  const button = createButton(options);

  // One button. Mounting twice - a script tag next to a bundled import, or a framework that
  // re-runs its setup - should not leave two of them stacked in the corner.
  const existing = doc.querySelector('[data-session-replay-button]');

  if (existing) existing.remove();

  let removed = false;

  // Removed before the document finished loading still means removed: the append is waiting
  // on an event, and without this it would put back a button the caller had let go of.
  whenBody(doc, () => {
    if (!removed) doc.body.appendChild(button);
  });

  return {
    element: button,
    remove() {
      removed = true;
      if (button.__srUnwatch) button.__srUnwatch();
      button.remove();
    }
  };
}

export { BUTTON_POSITIONS, BUTTON_LABEL };

// Pins whichever element is the outermost one - the wrapper when there is a credit line,
// the button when there is not - to its corner. An inline button is pinned to nothing.
function pin(node, { inline, position, offset, zIndex }) {
  if (inline) return;

  node.style.position = 'fixed';
  node.style.zIndex = String(zIndex);
  Object.assign(node.style, edges(position, offset));
  // Safe areas second, so a browser that has never heard of env() has already been given a
  // plain offset to fall back to. Without this the button sits under the home indicator on
  // an iPhone, which is a swipe that does something else.
  Object.assign(node.style, safeEdges(position, offset));
}

// Which two edges the button is pinned to. The other two are said explicitly rather than
// left out: a host page rule on `button` could have set the ones we do not want.
function edges(position, offset) {
  const [vertical, horizontal] = BUTTON_POSITIONS[position];
  const placement = { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' };

  placement[vertical] = offset;
  placement[horizontal] = offset;

  return placement;
}

function safeEdges(position, offset) {
  const [vertical, horizontal] = BUTTON_POSITIONS[position];

  return {
    [vertical]: `calc(${offset} + env(safe-area-inset-${vertical}, 0px))`,
    [horizontal]: `calc(${offset} + env(safe-area-inset-${horizontal}, 0px))`
  };
}

// Hover, focus and press without pseudo-classes. Every change repaints the base and then
// each state that is still true, in order, so releasing the mouse over a focused button
// leaves the focus ring rather than the pressed look.
function paintStates(node, states) {
  const on = { hover: false, active: false, focus: false };

  const paint = () => {
    Object.assign(node.style, states.base);
    if (on.hover && states.hover) Object.assign(node.style, states.hover);
    if (on.active && states.active) Object.assign(node.style, states.active);
    if (on.focus && states.focus) Object.assign(node.style, states.focus);
    Object.assign(node.style, node.__srPlacement || {});
    Object.assign(node.style, node.__srCompact || {});
  };

  const set = (key, value) => {
    on[key] = value;
    paint();
  };

  // The base object does not know where the button was pinned or whether it is compact, and
  // repainting it would otherwise undo both.
  node.__srPlacement = {
    top: node.style.top,
    right: node.style.right,
    bottom: node.style.bottom,
    left: node.style.left
  };

  node.addEventListener('mouseenter', () => set('hover', true));
  node.addEventListener('mouseleave', () => {
    on.active = false;
    set('hover', false);
  });
  node.addEventListener('pointerdown', () => set('active', true));
  node.addEventListener('pointerup', () => set('active', false));
  node.addEventListener('focus', () => set('focus', focusedByKeyboard(node)));
  node.addEventListener('blur', () => set('focus', false));
}

// A ring for the keyboard and not for the mouse, where the browser will tell us which it
// was. Where it will not, everything that takes focus gets one: a ring nobody needed is a
// smaller problem than a keyboard user who cannot see where they are.
function focusedByKeyboard(node) {
  try {
    return node.matches(':focus-visible');
  } catch {
    return true;
  }
}

// Narrow screens get the mark alone in a circle. There is no @media without a stylesheet,
// so the query is asked of matchMedia and the answer is written back as inline styles.
function applyCompact(button, text, compact, credit = null) {
  const shape = compact
    ? compactTriggerStyle()
    : { padding: '0.6875rem 1.05rem', width: 'auto', height: 'auto', minHeight: '2.75rem', gap: '0.5rem' };

  button.__srCompact = shape;
  Object.assign(button.style, shape);
  text.style.display = compact ? 'none' : 'inline';
  // The credit goes with the label. Under a 48px circle a line reading "Powered by Session
  // Replay" is three times the width of the thing it is crediting.
  if (credit) credit.style.display = compact ? 'none' : 'block';
}

function watchWidth(doc, button, text, credit = null) {
  const win = doc.defaultView;

  if (!win || typeof win.matchMedia !== 'function') return;

  const query = win.matchMedia(BUTTON_COMPACT_QUERY);
  const update = () => applyCompact(button, text, query.matches, credit);

  update();

  // addListener is the deprecated spelling, and it is the only one Safari knew until 14.
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', update);
    button.__srUnwatch = () => query.removeEventListener('change', update);
  } else if (typeof query.addListener === 'function') {
    query.addListener(update);
    button.__srUnwatch = () => query.removeListener(update);
  }
}

function motionAllowed(doc) {
  const win = doc.defaultView;

  if (!win || typeof win.matchMedia !== 'function') return true;

  return !win.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function whenBody(doc, place) {
  if (doc.body) {
    place();

    return;
  }

  // A script in the head has no body to append to yet. Waiting is better than the
  // alternatives, which are throwing or quietly doing nothing.
  doc.addEventListener('DOMContentLoaded', place, { once: true });
}

// The logo: an emerald tile with the corner brackets and the play triangle knocked out of
// it by a mask, so the button behind shows through the cut-outs.
//
// This is a second copy of the mark rather than one shared with splash.js, because there is
// no third module to put it in - the script-tag build concatenates a fixed list of files and
// this one is not on it.
function brandMark(doc, size, tile) {
  const maskId = markId();

  const svg = svgNode(
    doc,
    'svg',
    {
      viewBox: '0 0 64 64',
      width: String(size),
      height: String(size),
      // The button says "Report a bug" beside it, and carries that as its label besides, so
      // the mark is decoration. On the compact button the label is still the button's own.
      'aria-hidden': 'true',
      focusable: 'false'
    },
    { display: 'block', width: `${size}px`, height: `${size}px`, flex: '0 0 auto' }
  );

  const mask = svgNode(doc, 'mask', {
    id: maskId,
    maskUnits: 'userSpaceOnUse',
    x: '0',
    y: '0',
    width: '64',
    height: '64'
  });

  const brackets = svgNode(
    doc,
    'g',
    {},
    { stroke: '#000', strokeWidth: '5', strokeLinecap: 'round', fill: 'none' }
  );

  MARK_BRACKETS.forEach((d) => brackets.appendChild(svgNode(doc, 'path', { d })));

  mask.append(
    svgNode(doc, 'rect', { width: '64', height: '64' }, { fill: '#000' }),
    svgNode(doc, 'rect', { x: '3', y: '3', width: '58', height: '58', rx: '16' }, { fill: '#fff' }),
    brackets,
    svgNode(
      doc,
      'path',
      { d: MARK_TRIANGLE },
      { fill: '#000', stroke: '#000', strokeWidth: '4', strokeLinejoin: 'round' }
    )
  );

  const defs = svgNode(doc, 'defs');
  defs.appendChild(mask);

  svg.append(
    defs,
    svgNode(
      doc,
      'rect',
      {
        x: '3',
        y: '3',
        width: '58',
        height: '58',
        rx: '16',
        // The presentation attribute rather than the style property: CSS masking is spelled
        // differently across engines, while the SVG attribute means one thing everywhere.
        mask: `url(${markReference(doc)}#${maskId})`
      },
      // Fill as a style, because `svg rect { fill: ... }` in the host page would beat an
      // attribute and turn the mark whatever colour their icons are.
      { fill: tile }
    )
  );

  return svg;
}

// The mask id has to be unique in the host page's document, against every other copy of the
// mark - including one drawn by the overlay, and including a second copy of this library
// loaded alongside the first, which would start its own counter at one. Hence the random
// part as well as the counter.
let markIndex = 0;

function markId() {
  markIndex += 1;

  return `sr-button-mark-${markIndex}-${Math.random().toString(36).slice(2, 9)}`;
}

// url(#id) resolves against the document base URL, so a host page with a <base href> would
// send the mask reference to another document entirely. Only when there is one: an absolute
// reference otherwise is noise, and it would go stale the moment the page's own URL changed
// under the history API.
function markReference(doc) {
  if (typeof doc.querySelector !== 'function' || !doc.querySelector('base[href]')) return '';

  const here = String(doc.defaultView?.location?.href || doc.URL || '');

  return here.split('#')[0];
}

function svgNode(doc, tag, attributes = {}, styles = null) {
  const node = doc.createElementNS(BUTTON_SVG_NS, tag);

  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  if (styles) Object.assign(node.style, styles);

  return node;
}

// The attribute a site writes to say "put your button here".
//
// The whole point is that they write markup and no styling: one empty element, and the
// button that appears is ours - mark, wording, colours and states. A site that would rather
// design its own puts data-sr-trigger on whatever it likes instead, and this never runs.
export const BUTTON_PLACEHOLDER = 'data-session-replay-button';

/**
 * Fill every empty placeholder on the page with the branded button.
 *
 * Idempotent by construction: a placeholder with anything in it is left alone, and the
 * button this puts there is itself a child, so a second pass finds the element occupied
 * rather than adding a second button.
 *
 * @param {Object} [options]
 * @param {Document} [options.doc]
 * @param {string} [options.label]
 * @returns {number} how many were filled
 */
export function renderPlaceholders({ doc = document, label = BUTTON_LABEL } = {}) {
  let filled = 0;

  // Only elements written by the site. The button we create carries the same attribute as
  // its own handle, so it would otherwise be a placeholder for a button inside itself.
  doc.querySelectorAll(`[${BUTTON_PLACEHOLDER}]:empty`).forEach((slot) => {
    if (slot.nodeName === 'BUTTON') return;

    const asked = slot.getAttribute(BUTTON_PLACEHOLDER);

    slot.appendChild(
      createButton({
        doc,
        label: slot.getAttribute('data-label') || label,
        // An empty attribute means "wherever I put this". A corner name means the site
        // wants it floating, and put the element anywhere convenient to say so.
        inline: !BUTTON_POSITIONS[asked],
        position: BUTTON_POSITIONS[asked] ? asked : 'bottom-right',
        // The one-element install is the path for a site that would rather not write
        // JavaScript, so opting out of the credit has to be sayable in markup too -
        // otherwise the only way to do it is the mountButton() call this path exists to
        // avoid.
        attribution: slot.getAttribute('data-attribution') !== 'false'
      })
    );

    filled += 1;
  });

  return filled;
}
