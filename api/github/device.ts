/**
 * Same-origin proxy for GitHub's device-flow endpoints.
 *
 * github.com/login/device/code and /login/oauth/access_token don't allow
 * browser (CORS) requests, so the app calls this function instead. It holds no
 * secret and stores nothing: it forwards the GitHub App's public client ID plus
 * the device code or refresh token, and returns GitHub's JSON response as-is.
 * Device-flow tokens can be refreshed without a client secret.
 *
 * POST /api/github/device
 *   { "action": "start" }                              -> device + user code
 *   { "action": "poll", "device_code": "..." }         -> token or pending error
 *   { "action": "refresh", "refresh_token": "..." }    -> new token pair
 */

const GITHUB = 'https://github.com';
const DEVICE_CODE_RE = /^[A-Za-z0-9_-]{8,256}$/;
const REFRESH_TOKEN_RE = /^[A-Za-z0-9_-]{8,1024}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handleDeviceRequest(
  request: Request,
  clientId: string | undefined,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!clientId) {
    return json(
      {
        error: 'not_configured',
        error_description: 'GitHub sign-in is not configured on this deployment.',
      },
      501,
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const params = new URLSearchParams({ client_id: clientId });
  let endpoint: string;
  switch (body.action) {
    case 'start':
      endpoint = '/login/device/code';
      break;
    case 'poll':
      if (typeof body.device_code !== 'string' || !DEVICE_CODE_RE.test(body.device_code)) {
        return json({ error: 'bad_request' }, 400);
      }
      endpoint = '/login/oauth/access_token';
      params.set('device_code', body.device_code);
      params.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
      break;
    case 'refresh':
      if (typeof body.refresh_token !== 'string' || !REFRESH_TOKEN_RE.test(body.refresh_token)) {
        return json({ error: 'bad_request' }, 400);
      }
      endpoint = '/login/oauth/access_token';
      params.set('refresh_token', body.refresh_token);
      params.set('grant_type', 'refresh_token');
      break;
    default:
      return json({ error: 'bad_request' }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(GITHUB + endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'RunLines',
      },
      body: params,
    });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: 'upstream_error', status: upstream.status }, 502);
  }
  return json(data, upstream.ok ? 200 : upstream.status);
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleDeviceRequest(request, process.env.VITE_GITHUB_CLIENT_ID);
  },
};
