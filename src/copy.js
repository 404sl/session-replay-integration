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

  noToolbarTitle: 'Open this page in the browser',
  noToolbar:
    'Session Replay is installed, but this window has no toolbar to open it from. Chrome ' +
    'only lets an extension open its panel from its own button, and an app window has no ' +
    'extension buttons.',
  noToolbarNext:
    'Open this page in Chrome from the app menu, or copy the link below and paste it into ' +
    'a browser tab, then report the bug from there.',

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
    noToolbarTitle: 'Откройте эту страницу в браузере',
    noToolbar:
      'Session Replay установлен, но в этом окне нет панели инструментов, с которой его ' +
      'можно открыть. Chrome разрешает расширению открывать свою панель только по нажатию ' +
      'своей же кнопки, а в окне приложения кнопок расширений нет.',
    noToolbarNext:
      'Откройте эту страницу в Chrome через меню приложения или скопируйте ссылку ниже, ' +
      'вставьте её во вкладку браузера и сообщите об ошибке оттуда.',
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
    noToolbarTitle: 'Öffnen Sie diese Seite im Browser',
    noToolbar:
      'Session Replay ist installiert, aber dieses Fenster hat keine Symbolleiste, über die ' +
      'sie sich öffnen ließe. Chrome lässt eine Erweiterung ihr Panel nur über ihren eigenen ' +
      'Knopf öffnen, und ein App-Fenster hat keine Erweiterungsknöpfe.',
    noToolbarNext:
      'Öffnen Sie diese Seite über das App-Menü in Chrome, oder kopieren Sie den Link unten, ' +
      'fügen Sie ihn in einen Browser-Tab ein und melden Sie den Fehler von dort.',
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
    noToolbarTitle: 'Abre esta página en el navegador',
    noToolbar:
      'Session Replay está instalada, pero esta ventana no tiene barra de herramientas desde ' +
      'la que abrirla. Chrome solo permite que una extensión abra su panel desde su propio ' +
      'botón, y una ventana de aplicación no tiene botones de extensiones.',
    noToolbarNext:
      'Abre esta página en Chrome desde el menú de la aplicación, o copia el enlace de abajo ' +
      'y pégalo en una pestaña del navegador para informar del error desde allí.',
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
    noToolbarTitle: 'Ouvrez cette page dans le navigateur',
    noToolbar:
      "Session Replay est installée, mais cette fenêtre n'a pas de barre d'outils pour " +
      "l'ouvrir. Chrome ne laisse une extension ouvrir son panneau que depuis son propre " +
      "bouton, et une fenêtre d'application n'a aucun bouton d'extension.",
    noToolbarNext:
      "Ouvrez cette page dans Chrome depuis le menu de l'application, ou copiez le lien " +
      'ci-dessous et collez-le dans un onglet du navigateur, puis signalez le bug depuis là.',
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
    noToolbarTitle: 'Apri questa pagina nel browser',
    noToolbar:
      "Session Replay è installata, ma questa finestra non ha una barra degli strumenti da " +
      "cui aprirla. Chrome lascia che un'estensione apra il proprio pannello solo dal proprio " +
      'pulsante, e una finestra applicazione non ha pulsanti delle estensioni.',
    noToolbarNext:
      "Apri questa pagina in Chrome dal menu dell'applicazione, oppure copia il link qui " +
      'sotto e incollalo in una scheda del browser, poi segnala il bug da lì.',
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
    noToolbarTitle: 'Abra esta página no navegador',
    noToolbar:
      'O Session Replay está instalado, mas esta janela não tem barra de ferramentas por onde ' +
      'o abrir. O Chrome só deixa uma extensão abrir o seu painel a partir do seu próprio ' +
      'botão, e uma janela de aplicação não tem botões de extensões.',
    noToolbarNext:
      'Abra esta página no Chrome a partir do menu da aplicação, ou copie a ligação abaixo e ' +
      'cole-a num separador do navegador, e comunique o erro a partir de lá.',
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
export function pageLanguage(doc = globalThis.document) {
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
export function copyFor({ doc = null, lang = null } = {}) {
  // An explicit language needs no document at all. Defaulting doc to the global would make
  // copyFor({ lang: 'ru' }) fail anywhere there isn't one, for a value it never reads.
  const code = (lang || pageLanguage(doc || globalThis.document)).toLowerCase().split('-')[0];

  return { ...ENGLISH, ...(TRANSLATIONS[code] || {}) };
}

export { ENGLISH, TRANSLATIONS };
