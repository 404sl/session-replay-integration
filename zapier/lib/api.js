const BASE_URL = 'https://session-replay.com';
const REPLAYS_PATH = '/api/v1/replays';
const SITES_PATH = '/api/v1/sites';

const body = (response) => {
  if (response && typeof response.data === 'object' && response.data !== null) return response.data;
  if (response && typeof response.content === 'string' && response.content.length) {
    return JSON.parse(response.content);
  }

  return {};
};

const included = (document, type, id) => {
  const pool = Array.isArray(document.included) ? document.included : [];

  return pool.find((entry) => entry.type === type && String(entry.id) === String(id));
};

module.exports = { BASE_URL, REPLAYS_PATH, SITES_PATH, body, included };
