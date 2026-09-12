export const LIBRARY_VERSION = '0.4.0';

export const BEACON_ENDPOINT = 'https://session-replay.com/integration/events';

export const SHOWN_EVENT = 'button_shown';
export const PRESSED_EVENT = 'button_pressed';

let enabled = false;
let endpoint = BEACON_ENDPOINT;
let alreadySent = {};

export function configureBeacon({ beacon, beaconEndpoint } = {}) {
  if (beacon !== undefined) enabled = Boolean(beacon);
  if (beaconEndpoint) endpoint = String(beaconEndpoint);

  return enabled;
}

export function beaconEnabled() {
  return enabled;
}

export function resetBeacon() {
  enabled = false;
  endpoint = BEACON_ENDPOINT;
  alreadySent = {};
}

export function recordEvent(name, { nav = globalThis.navigator, once = false } = {}) {
  if (!enabled || !name) return false;
  if (once && alreadySent[name]) return false;
  if (!nav || typeof nav.sendBeacon !== 'function') return false;

  alreadySent[name] = true;

  try {
    return Boolean(
      nav.sendBeacon(endpoint, JSON.stringify({ event: name, version: LIBRARY_VERSION }))
    );
  } catch {
    return false;
  }
}
