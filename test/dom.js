// A DOM stub, not a DOM. Enough of one to run the builders end to end and catch the things
// that only show up when code is executed: a misspelled property, a call on something
// undefined, an element appended to nothing.
//
// jsdom would be more faithful and would also be the first dependency this package has ever
// had - for code whose whole promise to the sites loading it is that it brings nothing with
// it. A stub keeps that promise and still runs every line that builds the overlay.
export function fakeDom() {
  const created = [];

  const makeNode = (name) => {
    const node = {
      nodeName: name,
      style: {},
      children: [],
      attributes: {},
      listeners: {},
      textContent: '',
      // Read by the focus trap; nothing in a stub is genuinely focusable.
      focus() {
        node.focused = true;
      },
      matches: () => false,
      setAttribute(key, value) {
        node.attributes[key] = String(value);
      },
      getAttribute(key) {
        return node.attributes[key] ?? null;
      },
      removeAttribute(key) {
        delete node.attributes[key];
      },
      appendChild(child) {
        node.children.push(child);
        return child;
      },
      append(...kids) {
        kids.forEach((kid) => node.children.push(kid));
      },
      insertBefore(child) {
        node.children.unshift(child);
        return child;
      },
      remove() {
        node.removed = true;
      },
      addEventListener(type, fn) {
        (node.listeners[type] ||= []).push(fn);
      },
      removeEventListener(type, fn) {
        node.listeners[type] = (node.listeners[type] || []).filter((it) => it !== fn);
      },
      querySelectorAll: () => [],
      contains: () => true,
      select() {},
      setSelectionRange() {}
    };

    created.push(node);

    return node;
  };

  const body = makeNode('BODY');
  const documentElement = makeNode('HTML');
  documentElement.attributes.lang = 'en';

  const doc = {
    created,
    body,
    documentElement,
    activeElement: makeNode('BUTTON'),
    baseURI: 'https://example.com/checkout',
    createElement: (tag) => makeNode(tag.toUpperCase()),
    createElementNS: (_ns, tag) => makeNode(tag),
    createTextNode: (text) => {
      // Recorded like any other node: labels are often text nodes, and a stub that forgets
      // them makes the overlay look empty when it is not.
      const node = { nodeName: '#text', textContent: text };
      created.push(node);
      return node;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => true,
    addEventListener() {},
    removeEventListener() {},
    defaultView: {
      innerWidth: 1280,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      getComputedStyle: () => ({ overflow: 'visible', paddingRight: '0px' }),
      requestAnimationFrame: (fn) => fn(),
      setTimeout: (fn) => fn(),
      location: { href: 'https://example.com/checkout' },
      navigator: {}
    }
  };

  return doc;
}
