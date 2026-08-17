// Renders src/styles.js as a stylesheet.
//
// Not part of the browser bundle - build.mjs calls this and writes the result to
// dist/session-replay.css. The script-tag and npm paths apply the same styles inline, so
// shipping a CSS serialiser to a visitor's browser would be bytes nothing reads.
//
// The stylesheet exists for the path where the markup is written by hand: a site pastes four
// lines into its own template, the "Powered by" link is in its HTML source rather than
// injected afterwards, and the button still looks like ours. The floating variant stays a
// JavaScript one - mountButton() - because pinning something to a corner of a page we have
// never seen is a decision, not a default.

import {
  BUTTON_CLASS,
  attributionStyle,
  compactTriggerStyle,
  labelStyle,
  linkStyle,
  markSvg,
  rootStyle,
  triggerStates,
  triggerStyle
} from './styles.js';

// WebkitAppearance -> -webkit-appearance, borderRadius -> border-radius.
function property(name) {
  const kebab = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

  return /^(webkit|moz|ms)-/.test(kebab) ? `-${kebab}` : kebab;
}

function rule(selector, declarations, indent = '') {
  const body = Object.entries(declarations)
    .map(([name, value]) => `${indent}  ${property(name)}: ${value};`)
    .join('\n');

  return `${indent}${selector} {\n${body}\n${indent}}`;
}

export function stylesheet({ version }) {
  const states = triggerStates({ motion: true });
  const { root, trigger, label, attribution, link } = BUTTON_CLASS;

  return `/**
 * Session Replay integration ${version} - the branded "report a bug" button.
 * https://github.com/404sl/session-replay-integration
 *
 * For the markup-first path: write the button into your own template and load this, and the
 * "Powered by" link is in your HTML rather than added by a script afterwards.
 *
 *   <div class="${root}">
 *     <button type="button" data-sr-trigger class="${trigger}">
 *       <span class="${label}">Report a bug</span>
 *     </button>
 *     <small class="${attribution}">Powered by <a class="${link}" href="…">Session Replay</a></small>
 *   </div>
 *
 * Generated from src/styles.js. Do not edit: run npm run build.
 *
 * MIT licensed.
 */

${rule(`.${root}`, rootStyle({ inline: true }))}

${rule(`.${trigger}`, triggerStyle({ inline: true, motion: true }))}

${rule(`.${trigger}:hover`, states.hover)}

${rule(`.${trigger}:active`, states.active)}

/* focus-visible, not focus: a mouse click on a button should not leave a ring behind it.
   The inline path cannot ask this question - it has no pseudo-classes - so it paints the
   ring on focus and accepts the difference. */
${rule(`.${trigger}:focus-visible`, states.focus)}

/* The mark, as a data URI on a pseudo element: a stylesheet cannot build the masked SVG
   that the JavaScript path does, and a snippet with the whole logo pasted into it would not
   be four lines any more. Encoded rather than base64'd so it stays readable and gzips.
 *
 * :not([data-sr-mark]) because a page can load both this file and the script - the site's
 * snippet does exactly that - and a button the script built already has a real SVG mark in
 * it. Without this it gets two, side by side. Inline styles cannot switch a pseudo element
 * off, so the script says "mine has one" with an attribute and this rule steps aside. */
${rule(`.${trigger}:not([data-sr-mark])::before`, {
  content: '""',
  display: 'block',
  width: '1.25rem',
  height: '1.25rem',
  flex: '0 0 auto',
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(markSvg()).replace(/'/g, '%27').replace(/"/g, '%22')}")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: 'contain'
})}

${rule(`.${label}`, labelStyle())}

${rule(`.${attribution}`, attributionStyle())}

${rule(`.${link}`, linkStyle())}

${rule(`.${link}:hover`, { textDecorationThickness: '2px' })}

/* A pill wide enough to read is also wide enough to cover whatever the page put in that
   corner, and on a phone that corner is usually the important one. The attribution goes
   with the label: a line of small print under a 48px circle is wider than the circle. */
@media (max-width: 30rem) {
${rule(`.${trigger}`, compactTriggerStyle(), '  ')}

${rule(`.${label}`, { display: 'none' }, '  ')}

${rule(`.${attribution}`, { display: 'none' }, '  ')}
}

@media (prefers-reduced-motion: reduce) {
${rule(`.${trigger}`, { transition: 'none' }, '  ')}

${rule(`.${trigger}:hover`, { transform: 'none' }, '  ')}

${rule(`.${trigger}:active`, { transform: 'none' }, '  ')}
}
`;
}
