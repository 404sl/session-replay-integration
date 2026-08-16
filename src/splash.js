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
export function showSplash({ doc = document, supported = true, message = null } = {}) {
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

export { COPY, STORE_URL };

function element(doc, tag, styles) {
  const node = doc.createElement(tag);

  Object.assign(node.style, styles);

  return node;
}
