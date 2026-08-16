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

const BUTTON_SVG_NS = 'http://www.w3.org/2000/svg';

const BUTTON_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// #059669 is the brand emerald and it is 3.8:1 on white - a shape colour. White on the step
// darker, #047857, is 5.5:1, which is what a button with words on it needs.
const BUTTON_COLOR = {
  face:    '#047857',
  hover:   '#065f46',
  ring:    '#34d399',
  ink:     '#ffffff'
};

const BUTTON_LABEL = 'Report a bug';

// Which corner, and which two offsets that corner needs. Anything else falls back to the
// bottom right, where a floating action button has meant "help" for a decade.
const BUTTON_POSITIONS = {
  'bottom-right': ['bottom', 'right'],
  'bottom-left':  ['bottom', 'left'],
  'top-right':    ['top', 'right'],
  'top-left':     ['top', 'left']
};

// Under the overlay's 2147483000, because pressing this button is what opens that overlay
// and a trigger that floats above its own dialog is a trap. Still above the furniture of an
// ordinary page.
const BUTTON_Z_INDEX = '2147482000';

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
 * @returns {HTMLButtonElement}
 */
export function createButton(options = {}) {
  const {
    doc = document,
    position: asked = 'bottom-right',
    label = BUTTON_LABEL,
    offset = '1.25rem',
    zIndex = BUTTON_Z_INDEX,
    compact = 'auto',
    inline = false
  } = options;

  // A position we do not recognise is a typo, and a typo should still produce a button.
  const position = BUTTON_POSITIONS[asked] ? asked : 'bottom-right';

  const base = {
    // Inline buttons sit where the site put them, so they take no corner, no z-index and
    // no shadow: a floating action button announces itself, and one placed deliberately in
    // a footer should look like it belongs to the footer.
    position: inline ? 'static' : 'fixed',
    zIndex: inline ? 'auto' : String(zIndex),
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    boxSizing: 'border-box',
    margin: '0',
    padding: '0.6875rem 1.05rem',
    minWidth: '0',
    minHeight: '2.75rem',
    float: 'none',
    textIndent: '0',
    // Never wider than the screen it is pinned to, however long the label is.
    maxWidth: inline ? '100%' : 'calc(100vw - 2rem)',
    background: BUTTON_COLOR.face,
    color: BUTTON_COLOR.ink,
    border: '0',
    borderRadius: '999px',
    font: `700 0.9375rem/1.2 ${BUTTON_FONT}`,
    letterSpacing: 'normal',
    textTransform: 'none',
    textDecoration: 'none',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outline: 'none',
    opacity: '1',
    visibility: 'visible',
    transform: 'none',
    animation: 'none',
    boxShadow: inline ? 'none' : '0 0.35rem 1.1rem rgba(4, 120, 87, 0.34), 0 0 0 1px rgba(4, 120, 87, 0.06)',
    transition: motionAllowed(doc)
      ? 'background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease'
      : 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
    WebkitTapHighlightColor: 'transparent'
  };

  const button = doc.createElement('button');

  Object.assign(button.style, base);

  if (!inline) {
    Object.assign(button.style, edges(position, offset));
    // Safe areas second, so a browser that has never heard of env() has already been given
    // a plain offset to fall back to. Without this the button sits under the home indicator
    // on an iPhone, which is a swipe that does something else.
    Object.assign(button.style, safeEdges(position, offset));
  }

  button.type = 'button';
  button.setAttribute('data-sr-trigger', '');
  // Ours to find again, and a hook for a site that wants to move it without keeping the
  // handle we returned.
  button.setAttribute('data-session-replay-button', inline ? 'inline' : position);
  // The name stays on the element even when the visible label is dropped on a narrow
  // screen, so the button never becomes an unnamed circle.
  button.setAttribute('aria-label', label);
  button.title = label;

  const text = doc.createElement('span');

  Object.assign(text.style, {
    display: 'inline',
    margin: '0',
    padding: '0',
    font: 'inherit',
    color: 'inherit',
    letterSpacing: 'normal',
    textTransform: 'none',
    whiteSpace: 'nowrap'
  });
  text.textContent = label;

  // A white tile: the brackets and the play triangle are cut out of the mark, so the
  // button's own emerald shows through them.
  button.append(brandMark(doc, 20, BUTTON_COLOR.ink), text);

  paintStates(button, {
    base,
    hover: {
      background: BUTTON_COLOR.hover,
      boxShadow: '0 0.55rem 1.4rem rgba(4, 120, 87, 0.42), 0 0 0 1px rgba(4, 120, 87, 0.06)',
      transform: motionAllowed(doc) ? 'translateY(-1px)' : 'none'
    },
    active: { transform: 'translateY(1px)' },
    // Our own focus ring. The browser's would be removed by any host page with a
    // `*:focus { outline: none }` rule, and there is no rule of ours to answer that with.
    focus: {
      background: BUTTON_COLOR.hover,
      boxShadow: `0 0 0 3px ${BUTTON_COLOR.ring}, 0 0 0 5px rgba(4, 120, 87, 0.45)`
    }
  });

  applyCompact(button, text, compact === true);

  if (compact === 'auto') watchWidth(doc, button, text);

  return button;
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
function applyCompact(button, text, compact) {
  const shape = compact
    ? { padding: '0', width: '3rem', height: '3rem', minHeight: '3rem', borderRadius: '999px', gap: '0' }
    : { padding: '0.6875rem 1.05rem', width: 'auto', height: 'auto', minHeight: '2.75rem', gap: '0.5rem' };

  button.__srCompact = shape;
  Object.assign(button.style, shape);
  text.style.display = compact ? 'none' : 'inline';
}

function watchWidth(doc, button, text) {
  const win = doc.defaultView;

  if (!win || typeof win.matchMedia !== 'function') return;

  const query = win.matchMedia(BUTTON_COMPACT_QUERY);
  const update = () => applyCompact(button, text, query.matches);

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

  [
    'M15 24 V19 A4 4 0 0 1 19 15 H24',
    'M40 15 H45 A4 4 0 0 1 49 19 V24',
    'M49 40 V45 A4 4 0 0 1 45 49 H40',
    'M24 49 H19 A4 4 0 0 1 15 45 V40'
  ].forEach((d) => brackets.appendChild(svgNode(doc, 'path', { d })));

  mask.append(
    svgNode(doc, 'rect', { width: '64', height: '64' }, { fill: '#000' }),
    svgNode(doc, 'rect', { x: '3', y: '3', width: '58', height: '58', rx: '16' }, { fill: '#fff' }),
    brackets,
    svgNode(
      doc,
      'path',
      { d: 'M28 26 L40 32 L28 38 Z' },
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
        position: BUTTON_POSITIONS[asked] ? asked : 'bottom-right'
      })
    );

    filled += 1;
  });

  return filled;
}
