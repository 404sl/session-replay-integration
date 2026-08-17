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

const BUTTON_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// #059669 is the brand emerald and it is 3.8:1 on white - a shape colour. White on the step
// darker, #047857, is 5.5:1, which is what a button with words on it needs.
const BUTTON_COLOR = {
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
const BUTTON_CLASS = {
  root:        'sr-report',
  trigger:     'sr-report-trigger',
  label:       'sr-report-label',
  attribution: 'sr-report-by',
  link:        'sr-report-link'
};

const BUTTON_Z_INDEX = '2147482000';

// Where the "Powered by" link points. The parameters are what makes the referral countable;
// without them a click from a customer's footer is indistinguishable from direct traffic.
const ATTRIBUTION_URL =
  'https://session-replay.com/?utm_source=integration&utm_medium=button';

const ATTRIBUTION_PREFIX = 'Powered by ';
const ATTRIBUTION_NAME = 'Session Replay';

// The wrapper. It is what gets pinned to a corner, not the button: the attribution belongs
// under the button, and pinning the button itself would leave the line to be positioned
// separately and to disagree about which corner it was in.
function rootStyle({ inline = false } = {}) {
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
function triggerStyle({ inline = false, motion = true } = {}) {
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

function labelStyle() {
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

function attributionStyle() {
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

function linkStyle() {
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
function triggerStates({ motion = true } = {}) {
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
const MARK_BRACKETS = [
  'M15 24 V19 A4 4 0 0 1 19 15 H24',
  'M40 15 H45 A4 4 0 0 1 49 19 V24',
  'M49 40 V45 A4 4 0 0 1 45 49 H40',
  'M24 49 H19 A4 4 0 0 1 15 45 V40'
];

const MARK_TRIANGLE = 'M28 26 L40 32 L28 38 Z';

// The same mark as a standalone SVG, for the stylesheet's pseudo element.
//
// Built the same way brandMark() builds it: a rounded tile in the button's ink with the
// brackets and the triangle masked out of it, so the emerald behind shows through the
// cut-outs. Drawing the shapes as strokes instead would be the negative of the logo, which
// is a different mark that happens to be made of the same lines.
//
// A fixed mask id is safe here where it would not be in the document: each background-image
// data URI is parsed as its own document, so there is nothing for it to collide with.
function markSvg(ink = BUTTON_COLOR.ink) {
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
function compactTriggerStyle() {
  return {
    gap: '0',
    padding: '0',
    width: '3rem',
    height: '3rem',
    minHeight: '3rem',
    borderRadius: '999px'
  };
}

// The overlay, in the language of the page it appears on.
//
// This runs on somebody else's site, and that site may be in any language. An English
// overlay on a Russian page is the library announcing that it was not written for the
// person reading it - which is a poor first impression for something asking them to
// install software.
//
// The page is asked rather than the browser: document.documentElement.lang is what the
// site says it is publishing, and it is the language the surrounding words are already in.
// navigator.language is what the reader prefers, which is a different question and would
// have the overlay disagree with the paragraph next to it.
//
// English is the fallback and the base. Anything a translation leaves out falls through to
// it, so a partial translation is missing words rather than broken.

const ENGLISH = {
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

// The languages the site itself is published in. A page in anything else gets English,
// which is better than a half-translated overlay and honest about what we have.
const TRANSLATIONS = {
  ru: {
    title:   'Сообщите об ошибке в один клик',
    supported:
      'Session Replay — бесплатное расширение для Chrome. Нажмите кнопку, и оно соберёт ' +
      'всё об ошибке: никому не придётся спрашивать, что вы делали, когда она случилась.',
    captures: [
      'Скриншот или короткую запись того, что пошло не так',
      'Ошибки в консоли и сетевые запросы за ними',
      'Каждый клик, прокрутку и нажатие клавиши до этого момента',
      'Браузер, операционную систему и размер экрана — уже заполненные'
    ],
    free:        'Бесплатно, и аккаунт для отправки отчёта не нужен.',
    install:     'Установить в Chrome',
    installHint: 'откроет Chrome Web Store в новой вкладке',
    dismiss:     'Не сейчас',
    unsupportedTitle: 'Этот браузер не сможет его запустить',
    unsupported:
      'Session Replay — расширение для Chrome, а этот браузер не умеет их устанавливать. ' +
      'Chrome, Edge, Brave, Opera и Arc умеют.',
    unsupportedNext:
      'Скопируйте ссылку на эту страницу, откройте её в одном из них и сообщите об ошибке оттуда.',
    copy:         'Скопировать ссылку',
    copied:       'Ссылка скопирована.',
    copyManually: 'Ссылка выделена — нажмите Ctrl+C, или Cmd+C на Mac, чтобы скопировать.',
    blockedTitle: 'Откройте его с панели инструментов',
    panelBlocked:
      'Session Replay установлен. Откройте его с панели инструментов — Chrome разрешает ' +
      'расширению открывать свою панель только по нажатию своей же кнопки.',
    close: 'Закрыть',
    gotIt: 'Понятно'
  },

  de: {
    title:   'Melden Sie diesen Fehler mit einem Klick',
    supported:
      'Session Replay ist eine kostenlose Chrome-Erweiterung. Drücken Sie den Knopf, sie ' +
      'erfasst den Fehler - niemand muss Sie fragen, was Sie gerade getan haben.',
    captures: [
      'Ein Bildschirmfoto oder eine kurze Aufnahme des Fehlers',
      'Die Konsolenfehler und die Netzwerkanfragen dahinter',
      'Jeden Klick, jedes Scrollen und jeden Tastendruck davor',
      'Browser, Betriebssystem und Bildschirmgröße, bereits ausgefüllt'
    ],
    free:        'Kostenlos, und für einen Bericht wird kein Konto benötigt.',
    install:     'Zu Chrome hinzufügen',
    installHint: 'öffnet den Chrome Web Store in einem neuen Tab',
    dismiss:     'Jetzt nicht',
    unsupportedTitle: 'Dieser Browser kann sie nicht ausführen',
    unsupported:
      'Session Replay ist eine Chrome-Erweiterung, und dieser Browser kann keine ' +
      'installieren. Chrome, Edge, Brave, Opera und Arc können es.',
    unsupportedNext:
      'Kopieren Sie den Link zu dieser Seite, öffnen Sie ihn dort und melden Sie den Fehler von da aus.',
    copy:         'Seitenlink kopieren',
    copied:       'Link kopiert.',
    copyManually: 'Der Link ist markiert - drücken Sie Strg+C, auf einem Mac Cmd+C.',
    blockedTitle: 'Öffnen Sie sie über die Symbolleiste',
    panelBlocked:
      'Session Replay ist installiert. Öffnen Sie sie über die Symbolleiste - Chrome lässt ' +
      'eine Erweiterung ihr Panel nur über ihren eigenen Knopf öffnen.',
    close: 'Schließen',
    gotIt: 'Verstanden'
  },

  es: {
    title:   'Informa de este error con un clic',
    supported:
      'Session Replay es una extensión gratuita de Chrome. Pulsa el botón y captura el ' +
      'error: nadie tendrá que preguntarte qué estabas haciendo cuando ocurrió.',
    captures: [
      'Una captura de pantalla, o una grabación corta de lo que falló',
      'Los errores de consola y las peticiones de red que hay detrás',
      'Cada clic, desplazamiento y tecla que llevó hasta ahí',
      'Navegador, sistema operativo y tamaño de pantalla, ya rellenados'
    ],
    free:        'Gratis, y no hace falta cuenta para enviar un informe.',
    install:     'Añadir a Chrome',
    installHint: 'abre la Chrome Web Store en una pestaña nueva',
    dismiss:     'Ahora no',
    unsupportedTitle: 'Este navegador no puede ejecutarla',
    unsupported:
      'Session Replay es una extensión de Chrome, y este navegador no puede instalar ' +
      'ninguna. Chrome, Edge, Brave, Opera y Arc sí pueden.',
    unsupportedNext:
      'Copia el enlace de esta página, ábrelo en uno de ellos e informa del error desde allí.',
    copy:         'Copiar enlace',
    copied:       'Enlace copiado.',
    copyManually: 'El enlace está seleccionado: pulsa Ctrl+C, o Cmd+C en un Mac.',
    blockedTitle: 'Ábrela desde la barra de herramientas',
    panelBlocked:
      'Session Replay está instalada. Ábrela desde la barra de herramientas: Chrome solo ' +
      'permite que una extensión abra su panel desde su propio botón.',
    close: 'Cerrar',
    gotIt: 'Entendido'
  },

  fr: {
    title:   'Signalez ce bug en un clic',
    supported:
      'Session Replay est une extension Chrome gratuite. Appuyez sur le bouton, elle ' +
      "capture le bug - personne n'aura à vous demander ce que vous faisiez.",
    captures: [
      "Une capture d'écran, ou un court enregistrement de ce qui a échoué",
      'Les erreurs de console et les requêtes réseau derrière elles',
      'Chaque clic, défilement et touche qui y a mené',
      "Navigateur, système d'exploitation et taille d'écran, déjà remplis"
    ],
    free:        "Gratuit, et aucun compte n'est nécessaire pour envoyer un rapport.",
    install:     'Ajouter à Chrome',
    installHint: 'ouvre le Chrome Web Store dans un nouvel onglet',
    dismiss:     'Pas maintenant',
    unsupportedTitle: 'Ce navigateur ne peut pas la faire tourner',
    unsupported:
      "Session Replay est une extension Chrome, et ce navigateur ne peut pas en installer. " +
      'Chrome, Edge, Brave, Opera et Arc le peuvent.',
    unsupportedNext:
      'Copiez le lien de cette page, ouvrez-le dans un de ceux-là et signalez le bug depuis là.',
    copy:         'Copier le lien',
    copied:       'Lien copié.',
    copyManually: 'Le lien est sélectionné : appuyez sur Ctrl+C, ou Cmd+C sur un Mac.',
    blockedTitle: "Ouvrez-la depuis la barre d'outils",
    panelBlocked:
      "Session Replay est installée. Ouvrez-la depuis la barre d'outils : Chrome ne laisse " +
      'une extension ouvrir son panneau que depuis son propre bouton.',
    close: 'Fermer',
    gotIt: 'Compris'
  },

  it: {
    title:   'Segnala questo bug con un clic',
    supported:
      "Session Replay è un'estensione gratuita per Chrome. Premi il pulsante e cattura il " +
      'bug: nessuno dovrà chiederti cosa stavi facendo quando è successo.',
    captures: [
      'Uno screenshot, o una breve registrazione di cosa è andato storto',
      'Gli errori in console e le richieste di rete dietro di essi',
      'Ogni clic, scorrimento e tasto che ha portato fin lì',
      'Browser, sistema operativo e dimensioni dello schermo, già compilati'
    ],
    free:        'Gratis, e per inviare una segnalazione non serve un account.',
    install:     'Aggiungi a Chrome',
    installHint: 'apre il Chrome Web Store in una nuova scheda',
    dismiss:     'Non ora',
    unsupportedTitle: 'Questo browser non può eseguirla',
    unsupported:
      "Session Replay è un'estensione per Chrome, e questo browser non può installarne. " +
      'Chrome, Edge, Brave, Opera e Arc sì.',
    unsupportedNext:
      'Copia il link di questa pagina, aprilo in uno di quelli e segnala il bug da lì.',
    copy:         'Copia il link',
    copied:       'Link copiato.',
    copyManually: 'Il link è selezionato: premi Ctrl+C, o Cmd+C su un Mac.',
    blockedTitle: 'Aprila dalla barra degli strumenti',
    panelBlocked:
      "Session Replay è installata. Aprila dalla barra degli strumenti: Chrome lascia che " +
      "un'estensione apra il proprio pannello solo dal proprio pulsante.",
    close: 'Chiudi',
    gotIt: 'Ho capito'
  },

  pt: {
    title:   'Comunique este erro com um clique',
    supported:
      'O Session Replay é uma extensão gratuita do Chrome. Carregue no botão e ele capta ' +
      'o erro - ninguém terá de lhe perguntar o que estava a fazer quando aconteceu.',
    captures: [
      'Uma captura de ecrã, ou uma gravação curta do que correu mal',
      'Os erros de consola e os pedidos de rede por trás deles',
      'Cada clique, deslocamento e tecla que levou até ali',
      'Navegador, sistema operativo e tamanho do ecrã, já preenchidos'
    ],
    free:        'Gratuito, e não é preciso conta para enviar um relatório.',
    install:     'Adicionar ao Chrome',
    installHint: 'abre a Chrome Web Store num separador novo',
    dismiss:     'Agora não',
    unsupportedTitle: 'Este navegador não consegue executá-la',
    unsupported:
      'O Session Replay é uma extensão do Chrome, e este navegador não consegue instalar ' +
      'nenhuma. O Chrome, Edge, Brave, Opera e Arc conseguem.',
    unsupportedNext:
      'Copie a ligação desta página, abra-a num desses e comunique o erro a partir de lá.',
    copy:         'Copiar ligação',
    copied:       'Ligação copiada.',
    copyManually: 'A ligação está selecionada: carregue em Ctrl+C, ou Cmd+C num Mac.',
    blockedTitle: 'Abra-a a partir da barra de ferramentas',
    panelBlocked:
      'O Session Replay está instalado. Abra-o a partir da barra de ferramentas: o Chrome ' +
      'só deixa uma extensão abrir o seu painel a partir do seu próprio botão.',
    close: 'Fechar',
    gotIt: 'Percebi'
  }
};

/**
 * Which language the page says it is in.
 *
 * Only the part before the dash: a page marked pt-BR is answered in Portuguese rather than
 * in English, which is the better of the two wrong answers available.
 *
 * @param {Document} [doc]
 * @returns {string} a two-letter code, lowercased
 */
function pageLanguage(doc = globalThis.document) {
  const declared = doc?.documentElement?.getAttribute?.('lang') || '';

  return declared.trim().toLowerCase().split('-')[0];
}

/**
 * The overlay's words, for the page they are going onto.
 *
 * @param {Object} [options]
 * @param {Document} [options.doc]
 * @param {string} [options.lang] overrides what the page declares
 * @returns {Object} every key present, English wherever a translation is silent
 */
function copyFor({ doc = null, lang = null } = {}) {
  // An explicit language needs no document at all. Defaulting doc to the global would make
  // copyFor({ lang: 'ru' }) fail anywhere there isn't one, for a value it never reads.
  const code = (lang || pageLanguage(doc || globalThis.document)).toLowerCase().split('-')[0];

  return { ...ENGLISH, ...(TRANSLATIONS[code] || {}) };
}

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

// The words this overlay is being built with. Module scope rather than threaded through
// nine builders, which is safe for the same reason the singleton below is: one overlay
// exists at a time, and showSplash sets this before it builds anything. English until then,
// so nothing can read undefined.
let COPY = ENGLISH;

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
function showSplash({ doc = document, supported = true, message = null, lang = null } = {}) {
  if (openSplash) openSplash();

  // Resolved per call rather than once at load: the page decides the language, and a page
  // that sets it after this script ran - or changes it - should still be answered in it.
  COPY = copyFor({ doc, lang });

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
function createButton(options = {}) {
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
function mountButton(options = {}) {
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
const BUTTON_PLACEHOLDER = 'data-session-replay-button';

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
function renderPlaceholders({ doc = document, label = BUTTON_LABEL } = {}) {
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

// Marks a document as already listening, so calling init() twice is harmless.
const LISTENER_FLAG = '__sessionReplayDelegated';

// Whether the extension answered last time we asked. Detection runs when init() does, so a
// press can go straight to asking for the panel rather than spending the gesture on a round
// trip first. Null until asked; false is a real answer.
let knownPresent = null;

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

  // Asked before anything is awaited, when we already know the extension is there.
  //
  // The gesture is the point. sidePanel.open() needs the user activation Chrome forwards
  // from the click, and awaiting a round trip first spends it - the request would leave in
  // a later task, with the activation gone by the time the worker sees it. So detection
  // happens ahead of the press, and the press itself goes straight out.
  if (knownPresent) {
    const early = await requestPanel({ win });

    if (early.opened) return 'opened';

    return blocked(win, doc, early.reason);
  }

  const extension = await detectExtension({ win, ...options });

  knownPresent = Boolean(extension);

  if (!extension) {
    const supported = isSupportedBrowser({ nav });

    showSplash({ doc, supported });

    return supported ? 'missing' : 'unsupported';
  }

  const { opened, reason } = await requestPanel({ win });

  if (opened) return 'opened';

  return blocked(win, doc, reason);
}

// Everything that happens when the panel would not open. Reachable from two places now,
// because a press that already knew the extension was there skips detection entirely.
function blocked(win, doc, reason) {
  // Logged, not shown. The visitor needs to know what to do; whoever is integrating needs
  // to know which rule was hit, and the console is where they look.
  if (reason && win.console) win.console.warn(`[session-replay] panel did not open: ${reason}`);

  showSplash({ doc, supported: true, ...blockedMessage() });

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
function init(options = {}) {
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

  // Filled before the guard below, deliberately. A site that renders its placeholder after
  // the first run - any SPA, any page that builds its footer late - calls init() again, and
  // the guard would otherwise return early and leave that placeholder empty. Filling is
  // idempotent on its own: the selector only matches an element with nothing in it.
  renderPlaceholders({ doc });

  if (doc[LISTENER_FLAG]) return false;

  doc[LISTENER_FLAG] = true;

  // Ahead of any press, so the press itself has nothing to wait for. Nobody is looking at
  // the result yet, and a page with no extension simply records that.
  const win = options.win || globalThis.window;

  if (win) {
    detectExtension({ ...options, win })
      .then((found) => {
        knownPresent = Boolean(found);
      })
      .catch(() => {
        knownPresent = false;
      });
  }

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
  // mountButton is offered, never called for them. A script tag that put a floating
  // button on somebody's page uninvited would be an advert, not an integration.
  window.SessionReplay = Object.assign(window.SessionReplay || {}, {
    report,
    init,
    isAvailable,
    createButton,
    mountButton,
    // For a page that renders a placeholder after load and would rather say so than call
    // init() again.
    renderPlaceholders
  });
}());
