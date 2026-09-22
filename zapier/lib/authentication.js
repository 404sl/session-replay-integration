// OAuth2 connection to Session Replay.
//
// Session Replay is the provider; Zapier is a confidential client whose client_id and
// client_secret Zapier stores as CLIENT_ID / CLIENT_SECRET. The account authorizes once at
// /oauth/authorize, Zapier exchanges the code at /api/v1/auth/exchange, and refreshes at
// /api/v1/auth/login. PKCE is enabled, so no code interception can spend an authorization code.
//
// Both token endpoints answer JSON:API, so the tokens sit under data.attributes rather than at
// the top level, which is why getAccessToken and refreshAccessToken are functions.

const API_BASE = 'https://session-replay.com';
const SCOPE = 'mcp:read mcp:write';

const tokenAttributes = (response) => response?.data?.data?.attributes ?? {};

const tokensFrom = (response) => {
  const attributes = tokenAttributes(response);

  // The refresh token rotates on every use, so the fresh one must be persisted or the next
  // refresh is rejected as already-used.
  return { access_token: attributes.access_token, refresh_token: attributes.refresh_token };
};

const getAccessToken = async (z, bundle) => {
  const response = await z.request({
    url:    `${API_BASE}/api/v1/auth/exchange`,
    method: 'POST',
    body:   {
      code:          bundle.inputData.code,
      code_verifier: bundle.inputData.code_verifier,
      redirect_uri:  bundle.inputData.redirect_uri,
      client_id:     process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET
    }
  });

  return tokensFrom(response);
};

const refreshAccessToken = async (z, bundle) => {
  const response = await z.request({
    url:    `${API_BASE}/api/v1/auth/login`,
    method: 'POST',
    body:   {
      grant_type:    'refresh_token',
      refresh_token: bundle.authData.refresh_token,
      client_id:     process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET
    }
  });

  return tokensFrom(response);
};

// Proves the access token works and identifies the connected account. A 2xx is Zapier's signal
// that the connection is good.
const me = (z) => z.request({ url: `${API_BASE}/api/v1/me` });

const testAuth = async (z) => {
  const response = await me(z);

  return response.data;
};

// Shown against the connection so an account can tell which login a Zap runs on.
const connectionLabel = async (z) => {
  const response = await me(z);

  return response?.data?.data?.attributes?.email ?? 'Session Replay';
};

// Every request the Zap makes carries the access token. The OAuth token requests run before a
// token exists (getAccessToken) or carry it in the body (refresh), so a missing or stale header
// on those is harmless; the endpoints ignore it.
const addBearerHeader = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.access_token) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.access_token}`;
  }

  return request;
};

const authentication = {
  type: 'oauth2',
  test: testAuth,
  connectionLabel,
  oauth2Config: {
    authorizeUrl: {
      url:    `${API_BASE}/oauth/authorize`,
      params: {
        client_id:     '{{process.env.CLIENT_ID}}',
        state:         '{{bundle.inputData.state}}',
        redirect_uri:  '{{bundle.inputData.redirect_uri}}',
        response_type: 'code',
        scope:         SCOPE
      }
    },
    getAccessToken,
    refreshAccessToken,
    autoRefresh: true,
    enablePkce:  true,
    scope:       SCOPE
  }
};

module.exports = {
  API_BASE,
  SCOPE,
  authentication,
  addBearerHeader,
  getAccessToken,
  refreshAccessToken,
  testAuth,
  connectionLabel
};
