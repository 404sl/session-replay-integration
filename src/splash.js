// What somebody sees when they press the button without the extension.
//
// Drawn here rather than opened as a new tab: pressing "report a bug" and being navigated
// away from the bug is a poor trade, and the page they were on is the thing they wanted to
// report about.
//
// This is also the only moment we get to explain the product to somebody who has already
// told us they hit a problem, so it is written as an answer to "why would I install this?"
// rather than as an apology for not being installed.
//
// Styles are inline on the elements rather than in a stylesheet. This runs inside somebody
// else's page, where our class names are not ours and their reset may be anything, and a
// stylesheet of our own would be one more thing for their CSP to refuse. Because there is
// no stylesheet there are also no pseudo-classes: :hover and :focus are done with listeners
// that repaint inline styles, and anything that would need @media is asked of matchMedia
// instead.

const STORE_URL =
  'https://chromewebstore.google.com/detail/cpcncaaklnlebendcdejmhaoojoobfnl';

const SVG_NS = 'http://www.w3.org/2000/svg';

// The host page's font stack, deliberately: this is their page and the overlay should not
// look like an advert that wandered in. No web font, because that would be a network
// request from a library that promises to make none.
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Brand emerald is #059669, which is only 3.8:1 on white - enough for a shape, not enough
// for text. So the mark is emerald and everything with words in it uses the step darker,
// #047857 (5.5:1 against white), or darker still. On the dark header the accent is mint,
// which the palette keeps for exactly that.
//
// The header gradient runs forest to pine rather than starting at #047857, because the mint
// label on it is small text: mint on #047857 is 3.6:1 and fails, mint on #065f46 is 5.0:1
// and passes. The band lost a shade and the words became legible, which is the right way
// round for that trade.
const COLOR = {
  emerald:    '#059669',
  emeraldInk: '#047857',
  forest:     '#065f46',
  pine:       '#043c30',
  mint:       '#34d399',
  mintText:   '#6ee7b7',
  wash:       '#ecfdf5',
  ink:        '#212529',
  body:       '#495057',
  muted:      '#6c757d',
  line:       '#dee2e6',
  // The outline of a button has to be visible enough to find, which the hairline above is
  // not: #dee2e6 on white is 1.3:1 and this is 3.3:1, the floor for the parts of a control
  // that say where it is.
  edge:       '#868e96',
  paper:      '#ffffff',
  offPaper:   '#f8f9fa'
};

const COPY = {
  brand:   'Session Replay',
  title:   'Report this bug in one click',
  supported:
    'Session Replay is a free Chrome extension. Press the button, it captures the bug - ' +
    'nobody has to ask you what you were doing when it happened.',
  captures: [
    'A screenshot, or a short recording of what went wrong',
    'The console errors and the network requests behind them',
    'Every click, scroll and keystroke that led up to it',
    'Browser, operating system and screen size, already filled in'
  ],
  free:        'Free, and no account is needed to send a report.',
  install:     'Add to Chrome',
  installHint: 'opens the Chrome Web Store in a new tab',
  dismiss:     'Not now',

  unsupportedTitle: 'This browser cannot run it',
  unsupported:
    'Session Replay is a Chrome extension, and this browser cannot install one. Chrome, ' +
    'Edge, Brave, Opera and Arc all can.',
  unsupportedNext:
    'Copy the link to this page, open it in one of those, and report the bug from there.',
  copy:         'Copy page link',
  copied:       'Link copied.',
  copyManually: 'The link is selected - press Ctrl+C, or Cmd+C on a Mac, to copy it.',

  blockedTitle: 'Open it from the toolbar',
  panelBlocked:
    'Session Replay is installed. Open it from the toolbar - Chrome only lets an extension ' +
    'open its own panel from its own button.',

  close: 'Close',
  gotIt: 'Got it'
};

// Set on every element we make, before anything specific to that element.
//
// The host page may have global rules on div, p, button, a or * - and it is their page, so
// they are not wrong to. Anything we rely on has to be said rather than inherited or left
// to the user agent default. Declarations only lose to !important, which nothing sane uses
// on a bare element selector.
//
// Order matters inside this object: the font shorthand resets size, weight and line height,
// so it goes first and per-element overrides land after it.
const RESET = {
  font:          `400 15px/1.5 ${FONT}`,
  boxSizing:     'border-box',
  margin:        '0',
  padding:       '0',
  border:        '0',
  borderRadius:  '0',
  background:    'none',
  color:         COLOR.ink,
  // start rather than left: the host page may be running right to left, and the dialog
  // should read the way the rest of their page does.
  textAlign:     'start',
  textTransform: 'none',
  textDecoration: 'none',
  textIndent:    '0',
  textShadow:    'none',
  letterSpacing: 'normal',
  wordSpacing:   'normal',
  whiteSpace:    'normal',
  listStyle:     'none',
  boxShadow:     'none',
  outline:       'none',
  width:         'auto',
  height:        'auto',
  minWidth:      '0',
  minHeight:     '0',
  maxWidth:      'none',
  float:         'none',
  transform:     'none',
  transition:    'none',
  animation:     'none',
  visibility:    'visible',
  opacity:       '1',
  position:      'static'
};

// Everything the focus trap will cycle through. Deliberately short: this overlay only ever
// contains links and buttons, and a longer selector would be a promise about content that
// does not exist.
const FOCUSABLE = 'a[href], button, [tabindex]:not([tabindex="-1"])';

// Only one of these at a time. A second press while the first is still open would otherwise
// stack two dialogs, and the second one's scroll lock would remember the first one's locked
// state as the thing to restore.
let openSplash = null;

/**
 * Show the overlay.
 *
 * @param {Object} options
 * @param {Document} [options.doc]
 * @param {boolean} options.supported whether this browser could run the extension
 * @param {string} [options.message] replaces the body, for the panel-blocked case
 * @returns {Function} closes it
 */
export function showSplash({ doc = document, supported = true, message = null } = {}) {
  if (openSplash) openSplash();

  const win = doc.defaultView || null;
  const returnFocusTo = doc.activeElement;
  const titleId = uniqueId('sr-splash-title');
  const bodyId = uniqueId('sr-splash-body');

  const overlay = element(doc, 'div', {
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    // Above almost anything, without reaching for the maximum and starting an arms race
    // with the host page's own overlays.
    zIndex: '2147483000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    // Room to scroll to the card on a short viewport, without ever handing the scroll back
    // to the page underneath.
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    background: 'rgba(6, 24, 20, 0.62)',
    font: `400 15px/1.5 ${FONT}`,
    WebkitTapHighlightColor: 'transparent'
  });
  overlay.setAttribute('data-session-replay-splash', '');

  const card = element(doc, 'div', {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '30rem',
    // Never taller than the viewport: the body scrolls inside the card instead, so the
    // heading and the buttons stay where they are.
    maxHeight: 'calc(100vh - 2rem)',
    margin: 'auto',
    background: COLOR.paper,
    color: COLOR.ink,
    borderRadius: '1rem',
    overflow: 'hidden',
    boxShadow: '0 1.5rem 3.5rem rgba(2, 20, 15, 0.35), 0 0 0 1px rgba(6, 95, 70, 0.08)'
  });
  // Mobile browsers count the disappearing toolbar as part of 100vh, which would put the
  // last inch of the card under it. An engine that has never heard of dvh drops this and
  // keeps the vh above.
  card.style.maxHeight = 'calc(100dvh - 2rem)';

  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', titleId);
  card.setAttribute('aria-describedby', bodyId);
  // Focus lands on the dialog itself rather than on a button, so a screen reader reads the
  // pitch from the top instead of announcing "Not now" as the first thing about it.
  card.tabIndex = -1;

  let closed = false;
  const unlock = lockScroll(doc);

  const close = () => {
    if (closed) return;
    closed = true;
    openSplash = null;

    doc.removeEventListener('keydown', onKeydown, true);
    overlay.remove();
    unlock();

    // Back where they were, so the next Tab continues from the button they pressed rather
    // than from the top of the document.
    if (returnFocusTo && typeof returnFocusTo.focus === 'function' && doc.contains(returnFocusTo)) {
      returnFocusTo.focus();
    }
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      // Stopped as well as handled: a host page that also closes things on Escape should
      // not close its own menu because we were on top of it.
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === 'Tab') trapFocus(doc, card, event);
  };

  card.append(
    headerBar(doc, { supported, message, titleId, close }),
    bodySection(doc, { supported, message, bodyId, win }),
    actionBar(doc, { supported, message, close })
  );
  overlay.appendChild(card);

  // Clicking the backdrop closes; clicking the card does not. The press has to have started
  // on the backdrop too, so selecting text in the card and releasing outside it does not
  // count as "clicked away".
  let pressedBackdrop = false;
  const notePress = (event) => {
    pressedBackdrop = event.target === overlay;
  };

  // Both, because a browser with no pointer events would otherwise never record the press
  // and the backdrop would stop closing at all.
  overlay.addEventListener('pointerdown', notePress);
  overlay.addEventListener('mousedown', notePress);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && pressedBackdrop) close();
  });

  // Capture, so the host page's own document-level click and key handlers do not get to
  // swallow presses inside the dialog first.
  doc.addEventListener('keydown', onKeydown, true);

  doc.body.appendChild(overlay);
  card.focus();
  animateIn(win, card);

  openSplash = close;

  return close;
}

export { COPY, STORE_URL };

// The header carries the brand, because this is the one moment the visitor meets the
// product. Emerald on white is a shape colour, not a text colour, so the band is the darker
// end of the same hue and everything written on it is white or mint.
function headerBar(doc, { supported, message, titleId, close }) {
  const bar = element(doc, 'div', {
    position: 'relative',
    flex: '0 0 auto',
    padding: '1.25rem 3.25rem 1.25rem 1.25rem',
    background: `linear-gradient(135deg, ${COLOR.forest} 0%, ${COLOR.pine} 100%)`,
    color: COLOR.paper
  });

  const brand = element(doc, 'div', {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  });

  brand.append(
    logoMark(doc, { size: 26, tile: COLOR.mint }),
    text(doc, 'span', COPY.brand, {
      fontSize: '0.6875rem',
      fontWeight: '700',
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      color: COLOR.mintText
    })
  );

  const heading = text(doc, 'h2', headline({ supported, message }), {
    margin: '0.6rem 0 0',
    // Large text by the WCAG definition at bold 22px, and white on this band is 7.7:1 -
    // past the threshold for small text, never mind large.
    fontSize: '1.375rem',
    lineHeight: '1.25',
    fontWeight: '700',
    color: COLOR.paper
  });
  heading.id = titleId;

  bar.append(brand, heading, closeButton(doc, close));

  return bar;
}

function headline({ supported, message }) {
  if (message) return COPY.blockedTitle;

  return supported ? COPY.title : COPY.unsupportedTitle;
}

function closeButton(doc, close) {
  const base = {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.14)',
    color: COLOR.paper,
    cursor: 'pointer',
    transition: 'background-color 140ms ease, box-shadow 140ms ease'
  };

  const button = element(doc, 'button', base);
  button.type = 'button';
  button.setAttribute('aria-label', COPY.close);
  button.appendChild(crossIcon(doc));
  button.addEventListener('click', close);

  respond(button, {
    base,
    hover: { background: 'rgba(255, 255, 255, 0.28)' },
    focus: { background: 'rgba(255, 255, 255, 0.28)', boxShadow: `0 0 0 3px ${COLOR.mint}` }
  });

  return button;
}

function bodySection(doc, { supported, message, bodyId, win }) {
  const section = element(doc, 'div', {
    flex: '1 1 auto',
    padding: '1.25rem',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    background: COLOR.paper
  });

  const lead = text(doc, 'p', message || (supported ? COPY.supported : COPY.unsupported), {
    color: COLOR.body,
    fontSize: '0.9375rem'
  });
  lead.id = bodyId;
  section.appendChild(lead);

  // A list of what it captures only makes sense to somebody deciding whether to install it.
  // The other two states are talking to somebody who already has it, or cannot have it.
  if (supported && !message) {
    section.appendChild(captureList(doc));
    section.appendChild(
      text(doc, 'p', COPY.free, {
        margin: '1rem 0 0',
        fontSize: '0.8125rem',
        color: COLOR.muted
      })
    );
  }

  // Not a dead end. The visitor cannot install it here, but they can carry the page to a
  // browser where they can, and the link is the only part of that we can help with.
  if (!supported && !message) {
    section.appendChild(
      text(doc, 'p', COPY.unsupportedNext, {
        margin: '0.75rem 0 0.85rem',
        fontSize: '0.9375rem',
        color: COLOR.body
      })
    );
    section.appendChild(copyLinkRow(doc, win));
  }

  return section;
}

function captureList(doc) {
  const list = element(doc, 'ul', {
    display: 'block',
    margin: '1rem 0 0',
    padding: '0.875rem 0.9rem 0.9rem',
    background: COLOR.wash,
    borderRadius: '0.75rem'
  });
  // Safari drops list semantics from a list with no bullets, and this list is the argument.
  list.setAttribute('role', 'list');

  COPY.captures.forEach((line, index) => {
    const item = element(doc, 'li', {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.625rem',
      margin: index === 0 ? '0' : '0.5rem 0 0',
      fontSize: '0.9375rem',
      lineHeight: '1.45',
      color: '#374151'
    });
    item.setAttribute('role', 'listitem');
    item.append(tickIcon(doc), text(doc, 'span', line, { color: '#374151' }));
    list.appendChild(item);
  });

  return list;
}

// The address of the page, and a button that puts it on the clipboard. Everything here is
// local to the page: reading location and writing the clipboard are not requests.
function copyLinkRow(doc, win) {
  const row = element(doc, 'div', {
    display: 'flex',
    alignItems: 'stretch',
    gap: '0.5rem',
    flexWrap: 'wrap'
  });

  const href = String(win?.location?.href || doc.URL || '');

  const field = text(doc, 'span', href, {
    flex: '1 1 12rem',
    minWidth: '0',
    padding: '0.55rem 0.7rem',
    background: COLOR.offPaper,
    border: `1px solid ${COLOR.line}`,
    borderRadius: '0.5rem',
    font: '400 0.8125rem/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    color: COLOR.body,
    // One line with an ellipsis: a long URL should not push the buttons off the card.
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    direction: 'ltr'
  });

  const status = text(doc, 'p', '', {
    flex: '1 1 100%',
    minHeight: '1.25rem',
    margin: '0.15rem 0 0',
    fontSize: '0.8125rem',
    color: COLOR.emeraldInk
  });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const button = secondaryButton(doc, COPY.copy, () => {
    copyText(win, href)
      .then(() => {
        status.textContent = COPY.copied;
      })
      .catch(() => {
        // Clipboard access can be refused by permission, by an insecure context, or by a
        // browser that never had the API. Selecting the text turns the failure into the
        // one keystroke the visitor already knows.
        selectText(win, doc, field);
        status.textContent = COPY.copyManually;
      });
  });
  button.style.flex = '0 0 auto';

  row.append(field, button, status);

  return row;
}

function actionBar(doc, { supported, message, close }) {
  const bar = element(doc, 'div', {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    flexWrap: 'wrap',
    padding: '0 1.25rem 1.25rem',
    background: COLOR.paper
  });

  // No install button in a browser that cannot install it, and none when the extension is
  // already there and merely could not open its own panel.
  if (supported && !message) {
    bar.appendChild(installLink(doc));
    bar.appendChild(secondaryButton(doc, COPY.dismiss, close));

    return bar;
  }

  // With nothing to install, the only action left is the one that closes the dialog, so it
  // gets to be the primary button rather than a grey afterthought.
  bar.appendChild(primaryButton(doc, COPY.gotIt, close));

  return bar;
}

function installLink(doc) {
  const link = primaryButton(doc, COPY.install, null, 'a');

  link.href = STORE_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.insertBefore(logoMark(doc, { size: 18, tile: COLOR.paper }), link.firstChild);
  // Said out loud, not drawn: a link that opens elsewhere should say so to somebody who
  // cannot see the new tab appear.
  // Kept behind the visible words rather than in front of them, so the accessible name
  // still starts with "Add to Chrome" - which is what somebody using voice control will
  // say to press it.
  link.appendChild(visuallyHidden(doc, `, ${COPY.installHint}`));

  return link;
}

function primaryButton(doc, label, onClick, tag = 'button') {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    flex: '1 1 auto',
    minHeight: '2.75rem',
    padding: '0.6rem 1.1rem',
    background: COLOR.emeraldInk,
    color: COLOR.paper,
    borderRadius: '0.625rem',
    fontSize: '0.9375rem',
    fontWeight: '700',
    textAlign: 'center',
    textDecoration: 'none',
    cursor: 'pointer',
    boxShadow: '0 0.25rem 0.75rem rgba(4, 120, 87, 0.28)',
    transition: 'background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease'
  };

  const node = element(doc, tag, base);

  if (tag === 'button') node.type = 'button';
  node.appendChild(doc.createTextNode(label));
  if (onClick) node.addEventListener('click', onClick);

  respond(node, {
    base,
    hover: { background: COLOR.forest, boxShadow: '0 0.4rem 1rem rgba(4, 120, 87, 0.34)' },
    active: { transform: 'translateY(1px)' },
    // The focus ring is drawn by us because a host page's `:focus { outline: none }` would
    // take the browser's away and there is no rule of ours to win that argument with.
    focus: { background: COLOR.forest, boxShadow: `0 0 0 3px ${COLOR.mint}` }
  });

  return node;
}

function secondaryButton(doc, label, onClick) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '2.75rem',
    padding: '0.6rem 1rem',
    background: COLOR.paper,
    color: COLOR.body,
    border: `1px solid ${COLOR.edge}`,
    borderRadius: '0.625rem',
    fontSize: '0.9375rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease'
  };

  const button = element(doc, 'button', base);
  button.type = 'button';
  button.textContent = label;
  if (onClick) button.addEventListener('click', onClick);

  respond(button, {
    base,
    hover: { background: COLOR.offPaper, borderColor: COLOR.muted },
    focus: { background: COLOR.offPaper, boxShadow: '0 0 0 3px rgba(5, 150, 105, 0.45)' }
  });

  return button;
}

// The logo: an emerald tile with the corner brackets and the play triangle knocked out of
// it by a mask, so whatever is behind shows through the cut-outs and the mark works on the
// header, on a button and on white.
function logoMark(doc, { size = 32, tile = COLOR.emerald } = {}) {
  const maskId = uniqueId('sr-mark');

  const svg = svgElement(
    doc,
    'svg',
    {
      viewBox: '0 0 64 64',
      width: String(size),
      height: String(size),
      // Every place we draw this has the words "Session Replay" beside it, so the mark is
      // decoration and announcing it again would only be a stutter.
      'aria-hidden': 'true',
      focusable: 'false'
    },
    { display: 'block', width: `${size}px`, height: `${size}px`, flex: '0 0 auto' }
  );

  const mask = svgElement(doc, 'mask', {
    id: maskId,
    maskUnits: 'userSpaceOnUse',
    x: '0',
    y: '0',
    width: '64',
    height: '64'
  });

  const brackets = svgElement(
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
  ].forEach((d) => brackets.appendChild(svgElement(doc, 'path', { d })));

  mask.append(
    svgElement(doc, 'rect', { width: '64', height: '64' }, { fill: '#000' }),
    svgElement(doc, 'rect', { x: '3', y: '3', width: '58', height: '58', rx: '16' }, { fill: '#fff' }),
    brackets,
    svgElement(
      doc,
      'path',
      { d: 'M28 26 L40 32 L28 38 Z' },
      { fill: '#000', stroke: '#000', strokeWidth: '4', strokeLinejoin: 'round' }
    )
  );

  const defs = svgElement(doc, 'defs');
  defs.appendChild(mask);

  const face = svgElement(
    doc,
    'rect',
    {
      x: '3',
      y: '3',
      width: '58',
      height: '58',
      rx: '16',
      // A presentation attribute rather than a style property: CSS masking spells this
      // differently across engines, while the SVG attribute means one thing everywhere.
      mask: `url(${localReference(doc)}#${maskId})`
    },
    // Fill as a style, because `svg rect { fill: ... }` in the host page would beat an
    // attribute and turn the mark whatever colour their icons are.
    { fill: tile }
  );

  svg.append(defs, face);

  return svg;
}

function tickIcon(doc) {
  const svg = svgElement(
    doc,
    'svg',
    { viewBox: '0 0 20 20', width: '20', height: '20', 'aria-hidden': 'true', focusable: 'false' },
    { display: 'block', width: '1.25rem', height: '1.25rem', flex: '0 0 auto', marginTop: '0.15rem' }
  );

  svg.append(
    svgElement(doc, 'circle', { cx: '10', cy: '10', r: '10' }, { fill: 'rgba(5, 150, 105, 0.16)' }),
    svgElement(
      doc,
      'path',
      { d: 'M5.75 10.25 L8.75 13.25 L14.25 6.75' },
      {
        fill: 'none',
        stroke: COLOR.emeraldInk,
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      }
    )
  );

  return svg;
}

function crossIcon(doc) {
  const svg = svgElement(
    doc,
    'svg',
    { viewBox: '0 0 14 14', width: '14', height: '14', 'aria-hidden': 'true', focusable: 'false' },
    { display: 'block', width: '0.875rem', height: '0.875rem' }
  );

  svg.appendChild(
    svgElement(
      doc,
      'path',
      { d: 'M2 2 L12 12 M12 2 L2 12' },
      { fill: 'none', stroke: COLOR.paper, strokeWidth: '2', strokeLinecap: 'round' }
    )
  );

  return svg;
}

// Hover, focus and press without pseudo-classes. Each state is a patch over the base, and
// every change repaints all of them in order, so leaving hover while still focused does not
// take the focus ring with it.
function respond(node, states) {
  const on = { hover: false, active: false, focus: false };

  const paint = () => {
    Object.assign(node.style, states.base);
    if (on.hover && states.hover) Object.assign(node.style, states.hover);
    if (on.active && states.active) Object.assign(node.style, states.active);
    if (on.focus && states.focus) Object.assign(node.style, states.focus);
  };

  const set = (key, value) => {
    on[key] = value;
    paint();
  };

  node.addEventListener('mouseenter', () => set('hover', true));
  node.addEventListener('mouseleave', () => {
    on.active = false;
    set('hover', false);
  });
  node.addEventListener('pointerdown', () => set('active', true));
  node.addEventListener('pointerup', () => set('active', false));
  node.addEventListener('focus', () => set('focus', keyboardFocus(node)));
  node.addEventListener('blur', () => set('focus', false));
}

// A ring for the keyboard and not for the mouse, where the browser can tell us which it
// was. Where it cannot, everything that takes focus gets a ring - the wrong half of that
// trade is a ring nobody needed, and the other half is a keyboard user who is lost.
function keyboardFocus(node) {
  try {
    return node.matches(':focus-visible');
  } catch {
    return true;
  }
}

// Tab and Shift+Tab stay inside the dialog. The alternative is a visitor tabbing into a
// page they cannot see, pressing things they cannot see either.
function trapFocus(doc, card, event) {
  const stops = Array.from(card.querySelectorAll(FOCUSABLE)).filter(
    (node) => node.offsetWidth > 0 || node.offsetHeight > 0 || node === doc.activeElement
  );

  if (!stops.length) {
    event.preventDefault();
    card.focus();

    return;
  }

  const first = stops[0];
  const last = stops[stops.length - 1];
  const active = doc.activeElement;

  if (!card.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && (active === first || active === card)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

// The page underneath must not scroll while a modal is over it - on a phone especially,
// where a flick anywhere is a scroll. Both elements, because which one carries the page
// scroll depends on the host page's own layout.
function lockScroll(doc) {
  const root = doc.documentElement;
  const { body } = doc;
  const win = doc.defaultView;
  const before = {
    rootOverflow: root.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPadding: body.style.paddingRight
  };

  // Taking the scrollbar away makes the page a scrollbar wider. Putting that width back as
  // padding stops the host page's layout jumping sideways as the overlay opens.
  const gap = win ? win.innerWidth - root.clientWidth : 0;

  if (gap > 0 && win) {
    const current = parseFloat(win.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + gap}px`;
  }

  root.style.overflow = 'hidden';
  body.style.overflow = 'hidden';

  return () => {
    root.style.overflow = before.rootOverflow;
    body.style.overflow = before.bodyOverflow;
    body.style.paddingRight = before.bodyPadding;
  };
}

// A short rise as it opens, so the dialog reads as something that arrived rather than
// something that was always there and only just became visible. Skipped outright for
// anybody who has asked for less motion.
function animateIn(win, card) {
  if (!win || typeof win.requestAnimationFrame !== 'function') return;
  if (win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

  Object.assign(card.style, { opacity: '0', transform: 'translateY(0.75rem) scale(0.985)' });

  win.requestAnimationFrame(() => {
    Object.assign(card.style, {
      transition: 'opacity 160ms ease-out, transform 220ms cubic-bezier(0.2, 0.8, 0.3, 1)',
      opacity: '1',
      // Back to none rather than to a zero transform: a card left with a transform is a
      // containing block, and anything positioned inside it later would be measured from
      // the card instead of the viewport.
      transform: 'none'
    });
  });
}

function copyText(win, value) {
  try {
    const written = win?.navigator?.clipboard?.writeText(value);

    return written ? Promise.resolve(written) : Promise.reject(new Error('no clipboard'));
  } catch (error) {
    return Promise.reject(error);
  }
}

function selectText(win, doc, node) {
  try {
    const range = doc.createRange();
    const selection = win.getSelection();

    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // A browser that will not select for us is one the visitor can still select by hand.
  }
}

function visuallyHidden(doc, string) {
  return text(doc, 'span', string, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap'
  });
}

// Ids have to be unique in the host page's document, and the mask ids inside the logo have
// to be unique against every other copy of the logo - including a second copy of this
// library loaded by a script tag next to a bundled one, which would start its own counter
// at one. Hence the random part as well as the counter.
let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;

  return `${prefix}-${sequence}-${Math.random().toString(36).slice(2, 9)}`;
}

// url(#id) is resolved against the document base URL, so a host page with a <base href>
// would send the mask reference to another document entirely. Only when there is one:
// an absolute reference otherwise is noise in the markup, and it would break the moment
// the page's own URL changed under a history API.
function localReference(doc) {
  if (typeof doc.querySelector !== 'function' || !doc.querySelector('base[href]')) return '';

  const here = String(doc.defaultView?.location?.href || doc.URL || '');

  return here.split('#')[0];
}

function element(doc, tag, styles) {
  const node = doc.createElement(tag);

  Object.assign(node.style, { ...RESET, ...styles });

  return node;
}

function text(doc, tag, string, styles) {
  const node = element(doc, tag, styles);

  node.textContent = string;

  return node;
}

function svgElement(doc, tag, attributes = {}, styles = null) {
  const node = doc.createElementNS(SVG_NS, tag);

  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  // No RESET here: it is written for the box model, and half of it means something else
  // inside an SVG - `width: auto` on a rect is a geometry property, not a layout one.
  if (styles) Object.assign(node.style, styles);

  return node;
}
