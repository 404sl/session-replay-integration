// What the branded button looks like, as data.
//
// There are now two ways the same button gets its appearance, and they have to agree:
//
//   - createButton() writes these objects onto elements as inline styles, because this is
//     somebody else's page and a host rule on `button` would otherwise win.
//   - a site that pastes the markup into its own template gets them as a stylesheet, from
//     dist/session-replay.css, which build.mjs renders from this same file.
//
// Written once here rather than twice, because two hand-maintained copies of a button's
// appearance drift on the first change and the drift is invisible until somebody compares
// a pasted snippet against a mounted one.
//
// The names are prefixed the way everything in this package is: the script-tag build
// concatenates the sources into one scope, so a bare `COLOR` here would collide with
// splash.js.

export const BUTTON_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// #059669 is the brand emerald and it is 3.8:1 on white - a shape colour. White on the step
// darker, #047857, is 5.5:1, which is what a button with words on it needs.
export const BUTTON_COLOR = {
  face:    '#047857',
  hover:   '#065f46',
  ring:    '#34d399',
  ink:     '#ffffff',
  // The attribution line sits on the host page's own background, not on the button, so it
  // is measured against white: #4b5563 is 7.6:1, and the link a step darker again.
  quiet:   '#4b5563',
  quietInk: '#047857'
};

// Class names for the stylesheet path. The inline path never reads them for styling - they
// go on the elements anyway, so that a site which wants to override something has a handle,
// and so the two paths produce the same DOM.
export const BUTTON_CLASS = {
  root:        'sr-report',
  trigger:     'sr-report-trigger',
  label:       'sr-report-label',
  attribution: 'sr-report-by',
  link:        'sr-report-link'
};

export const BUTTON_Z_INDEX = '2147482000';

// Where the "Powered by" link points. The parameters are what makes the referral countable;
// without them a click from a customer's footer is indistinguishable from direct traffic.
export const ATTRIBUTION_URL =
  'https://session-replay.com/?utm_source=integration&utm_medium=button';

export const ATTRIBUTION_PREFIX = 'Powered by ';
export const ATTRIBUTION_NAME = 'Session Replay';

// The wrapper. It is what gets pinned to a corner, not the button: the attribution belongs
// under the button, and pinning the button itself would leave the line to be positioned
// separately and to disagree about which corner it was in.
export function rootStyle({ inline = false } = {}) {
  return {
    position: inline ? 'static' : 'fixed',
    zIndex: inline ? 'auto' : BUTTON_Z_INDEX,
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.3125rem',
    boxSizing: 'border-box',
    margin: '0',
    padding: '0',
    border: '0',
    maxWidth: inline ? '100%' : 'calc(100vw - 2rem)',
    font: `400 0.6875rem/1.3 ${BUTTON_FONT}`,
    textAlign: 'center'
  };
}

// The trigger. Most of this is defence rather than design: a host page's reset for `button`
// applies to ours too, so anything that would visibly break if inherited is said explicitly.
export function triggerStyle({ inline = false, motion = true } = {}) {
  return {
    position: 'static',
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
    maxWidth: '100%',
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
    boxShadow: inline
      ? 'none'
      : '0 0.35rem 1.1rem rgba(4, 120, 87, 0.34), 0 0 0 1px rgba(4, 120, 87, 0.06)',
    transition: motion
      ? 'background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease'
      : 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
    WebkitTapHighlightColor: 'transparent'
  };
}

export function labelStyle() {
  return {
    display: 'inline',
    margin: '0',
    padding: '0',
    font: 'inherit',
    color: 'inherit',
    letterSpacing: 'normal',
    textTransform: 'none',
    whiteSpace: 'nowrap'
  };
}

export function attributionStyle() {
  return {
    display: 'block',
    margin: '0',
    padding: '0',
    font: `400 0.6875rem/1.3 ${BUTTON_FONT}`,
    color: BUTTON_COLOR.quiet,
    letterSpacing: 'normal',
    textTransform: 'none',
    whiteSpace: 'nowrap'
  };
}

export function linkStyle() {
  return {
    color: BUTTON_COLOR.quietInk,
    font: 'inherit',
    textDecoration: 'underline',
    // 0.3ex is about a hair; enough that the underline reads as a link without crowding the
    // descenders at eleven pixels.
    textUnderlineOffset: '0.15em'
  };
}

// Hover, active and focus. The inline path repaints these with listeners, since inline
// styles have no pseudo-classes; the stylesheet path gets them as real selectors.
export function triggerStates({ motion = true } = {}) {
  return {
    hover: {
      background: BUTTON_COLOR.hover,
      boxShadow: '0 0.55rem 1.4rem rgba(4, 120, 87, 0.42), 0 0 0 1px rgba(4, 120, 87, 0.06)',
      transform: motion ? 'translateY(-1px)' : 'none'
    },
    active: { transform: 'translateY(1px)' },
    // Our own focus ring. The browser's would be removed by any host page with a
    // `*:focus { outline: none }` rule, and there is no rule of ours to answer that with.
    focus: {
      background: BUTTON_COLOR.hover,
      boxShadow: `0 0 0 3px ${BUTTON_COLOR.ring}, 0 0 0 5px rgba(4, 120, 87, 0.45)`
    }
  };
}

// The geometry of the mark, so the two paths draw the same logo.
//
// brandMark() builds an SVG from these at runtime, masked so the button's emerald shows
// through the cut-outs; the stylesheet path cannot run code, so it gets the same shapes as a
// data URI on a ::before. Shared from here because a hand-copied second set of path data is
// a logo that quietly stops matching the logo.
export const MARK_BRACKETS = [
  'M15 24 V19 A4 4 0 0 1 19 15 H24',
  'M40 15 H45 A4 4 0 0 1 49 19 V24',
  'M49 40 V45 A4 4 0 0 1 45 49 H40',
  'M24 49 H19 A4 4 0 0 1 15 45 V40'
];

export const MARK_TRIANGLE = 'M28 26 L40 32 L28 38 Z';

// The same mark as a standalone SVG, for the stylesheet's pseudo element.
//
// Built the same way brandMark() builds it: a rounded tile in the button's ink with the
// brackets and the triangle masked out of it, so the emerald behind shows through the
// cut-outs. Drawing the shapes as strokes instead would be the negative of the logo, which
// is a different mark that happens to be made of the same lines.
//
// A fixed mask id is safe here where it would not be in the document: each background-image
// data URI is parsed as its own document, so there is nothing for it to collide with.
export function markSvg(ink = BUTTON_COLOR.ink) {
  const brackets = MARK_BRACKETS.map((d) => `<path d="${d}"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">` +
    `<rect width="64" height="64" fill="#000"/>` +
    `<rect x="3" y="3" width="58" height="58" rx="16" fill="#fff"/>` +
    `<g fill="none" stroke="#000" stroke-width="5" stroke-linecap="round">${brackets}</g>` +
    `<path d="${MARK_TRIANGLE}" fill="#000" stroke="#000" stroke-width="4" ` +
    `stroke-linejoin="round"/>` +
    `</mask></defs>` +
    `<rect x="3" y="3" width="58" height="58" rx="16" fill="${ink}" mask="url(#m)"/>` +
    `</svg>`;
}

// Narrow screens drop the label and the button becomes a mark in a circle.
export function compactTriggerStyle() {
  return {
    gap: '0',
    padding: '0',
    width: '3rem',
    height: '3rem',
    minHeight: '3rem',
    borderRadius: '999px'
  };
}
