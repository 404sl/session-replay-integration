const test = require('node:test');
const assert = require('node:assert/strict');

const {
  addBearerHeader,
  getAccessToken,
  refreshAccessToken,
  testAuth,
  connectionLabel,
  authentication
} = require('../lib/authentication');

const jsonApi = (attributes) => ({ data: { data: { id: '1', type: 'auth_token', attributes } } });

test('the bearer middleware adds the access token when the connection has one', () => {
  const request = addBearerHeader({ headers: {} }, {}, { authData: { access_token: 'abc' } });

  assert.equal(request.headers.Authorization, 'Bearer abc');
});

test('the bearer middleware leaves an unconnected request alone', () => {
  const request = addBearerHeader({ headers: {} }, {}, { authData: {} });

  assert.equal(request.headers.Authorization, undefined);
});

test('exchanging the code reads the tokens and expiry out of the JSON:API body', async () => {
  const z = { request: async () => jsonApi({ access_token: 'AT', refresh_token: 'RT', expires_in: 86400 }) };

  const tokens = await getAccessToken(z, { inputData: { code: 'c', code_verifier: 'v', redirect_uri: 'r' } });

  assert.deepEqual(tokens, { access_token: 'AT', refresh_token: 'RT', expires_in: 86400 });
});

test('refreshing returns the rotated refresh token and expiry so the connection is not marked dead', async () => {
  const z = { request: async () => jsonApi({ access_token: 'AT2', refresh_token: 'RT2', expires_in: 86400 }) };

  const tokens = await refreshAccessToken(z, { authData: { refresh_token: 'RT1' } });

  assert.deepEqual(tokens, { access_token: 'AT2', refresh_token: 'RT2', expires_in: 86400 });
});

test('the exchange and refresh hit the JSON:API auth endpoints', async () => {
  const seen = [];
  const z = {
    request: async (req) => {
      seen.push(req.url);
      return jsonApi({ access_token: 'x', refresh_token: 'y' });
    }
  };

  await getAccessToken(z, { inputData: {} });
  await refreshAccessToken(z, { authData: {} });

  assert.ok(seen[0].endsWith('/api/v1/auth/exchange'));
  assert.ok(seen[1].endsWith('/api/v1/auth/login'));
});

test('the connection test and label read the account from the token-authed profile endpoint', async () => {
  const urls = [];
  const z = {
    request: async (req) => {
      urls.push(req.url);
      return { data: { data: { attributes: { email: 'a@b.co' } } } };
    }
  };

  await testAuth(z);
  const label = await connectionLabel(z);

  // Must NOT be /api/v1/me: that is session-authed and 401s a bearer token.
  assert.ok(urls.every((url) => url.endsWith('/api/v1/user/profile')));
  assert.equal(label, 'a@b.co');
});

test('the authorize step asks for a code with PKCE and the read and write scope', () => {
  const config = authentication.oauth2Config;

  assert.ok(config.authorizeUrl.url.endsWith('/oauth/authorize'));
  assert.equal(config.authorizeUrl.params.response_type, 'code');
  assert.equal(config.enablePkce, true);
  assert.equal(config.autoRefresh, true);
  assert.equal(config.scope, 'mcp:read mcp:write');
});
