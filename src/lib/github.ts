import type { GitHubAuth } from '../types';
import { clearGitHubAuth, getGitHubAuth, saveGitHubAuth } from './storage';

const API = 'https://api.github.com';
const DEVICE_PROXY = '/api/github/device';
const DEFAULT_VERIFY_URI = 'https://github.com/login/device';

/** "Sign in with GitHub" needs the GitHub App's client ID at build time. */
export const githubSignInEnabled = !!import.meta.env.VITE_GITHUB_CLIENT_ID;

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

/* ---------- URLs ---------- */

interface Candidate {
  /** Omitted = repo default branch. */
  ref?: string;
  path: string[];
}

export interface GitHubLocation {
  owner: string;
  repo: string;
  /** Ways to split the URL into ref + path (branch names can contain '/'), most likely first. */
  candidates: Candidate[];
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function splitRefAndPath(segs: string[]): Candidate[] {
  if (segs[0] === 'refs' && (segs[1] === 'heads' || segs[1] === 'tags')) segs = segs.slice(2);
  const out: Candidate[] = [];
  for (let i = 1; i < segs.length && i <= 4; i++) {
    out.push({ ref: segs.slice(0, i).join('/'), path: segs.slice(i) });
  }
  return out;
}

/**
 * Recognise GitHub file links: github.com …/blob/… or …/raw/…,
 * raw.githubusercontent.com, and api.github.com …/contents/….
 */
export function parseGitHubUrl(input: string): GitHubLocation | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean).map(safeDecode);
  if (parts.some((p) => p === '.' || p === '..')) return null;

  let owner: string;
  let repo: string;
  let candidates: Candidate[];
  if ((host === 'github.com' || host === 'www.github.com') && parts.length >= 5) {
    if (parts[2] !== 'blob' && parts[2] !== 'raw') return null;
    [owner, repo] = parts;
    candidates = splitRefAndPath(parts.slice(3));
  } else if (host === 'raw.githubusercontent.com' && parts.length >= 4) {
    [owner, repo] = parts;
    candidates = splitRefAndPath(parts.slice(2));
  } else if (
    host === 'api.github.com' &&
    parts.length >= 5 &&
    parts[0] === 'repos' &&
    parts[3] === 'contents'
  ) {
    owner = parts[1];
    repo = parts[2];
    candidates = [{ ref: u.searchParams.get('ref') || undefined, path: parts.slice(4) }];
  } else {
    return null;
  }
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || candidates.length === 0) return null;
  return { owner, repo, candidates };
}

/** Drop the short-lived `?token=` GitHub adds to private raw links so it's never saved. */
export function cleanSourceUrl(input: string): string {
  const s = input.trim();
  try {
    const u = new URL(s);
    if (u.hostname.toLowerCase() === 'raw.githubusercontent.com' && u.searchParams.has('token')) {
      u.searchParams.delete('token');
      return u.toString();
    }
  } catch {
    /* not a URL */
  }
  return s;
}

/* ---------- Authenticated reads ---------- */

function apiHeaders(token: string, accept: string): HeadersInit {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: unknown };
    if (typeof j.message === 'string' && j.message) return `HTTP ${res.status} — ${j.message}`;
  } catch {
    /* not JSON */
  }
  return `HTTP ${res.status}`;
}

function signedOutError(): GitHubError {
  clearGitHubAuth();
  return new GitHubError(401, 'Your GitHub sign-in expired or was revoked. Sign in again.');
}

async function apiGet(url: string, accept: string): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new GitHubError(401, 'Not signed in to GitHub.');
  let res = await fetch(url, { headers: apiHeaders(token, accept), cache: 'no-store' });
  if (res.status === 401) {
    const auth = getGitHubAuth();
    if (auth?.kind === 'app' && auth.refreshToken) {
      const next = await refreshAuth(auth);
      res = await fetch(url, { headers: apiHeaders(next.token, accept), cache: 'no-store' });
    }
    if (res.status === 401) throw signedOutError();
  }
  if (!res.ok) throw new GitHubError(res.status, await errorMessage(res));
  return res;
}

/** Read a file's raw text through the contents API (works for private repos). */
export async function fetchGitHubFile(loc: GitHubLocation): Promise<string> {
  const base = `${API}/repos/${encodeURIComponent(loc.owner)}/${encodeURIComponent(loc.repo)}/contents/`;
  let notFound: GitHubError | null = null;
  for (const c of loc.candidates) {
    const url =
      base +
      c.path.map(encodeURIComponent).join('/') +
      (c.ref ? `?ref=${encodeURIComponent(c.ref)}` : '');
    try {
      const res = await apiGet(url, 'application/vnd.github.raw+json');
      return await res.text();
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) {
        notFound = e;
        continue;
      }
      throw e;
    }
  }
  throw notFound ?? new GitHubError(404, 'HTTP 404');
}

/** Explain a 404 from a signed-in read: wrong link, or no access to that repo. */
export function notFoundHint(auth: GitHubAuth, loc: GitHubLocation): string {
  const repo = `${loc.owner}/${loc.repo}`;
  return auth.kind === 'app'
    ? `Not found, or RunLines can’t see ${repo}. Check the link, and that the RunLines GitHub App is installed on that repo (github.com/settings/installations).`
    : `Not found, or your token can’t see ${repo}. Check the link, and the token’s repository access.`;
}

async function fetchPublic(rawUrl: string): Promise<string> {
  const res = await fetch(rawUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new GitHubError(res.status, `HTTP ${res.status}${res.status === 404 ? ' — file not found' : ''}`);
  }
  return res.text();
}

/**
 * Fetch script text. Signed-in GitHub links go through the API (private repos);
 * if that can't see the file, or the sign-in just expired, try the public raw URL
 * before giving up.
 */
export async function fetchScriptText(rawUrl: string, loc: GitHubLocation | null): Promise<string> {
  if (!loc || !getGitHubAuth()) return fetchPublic(rawUrl);
  try {
    return await fetchGitHubFile(loc);
  } catch (e) {
    if (!(e instanceof GitHubError) || ![401, 403, 404].includes(e.status)) throw e;
    try {
      return await fetchPublic(rawUrl);
    } catch {
      throw e;
    }
  }
}

/* ---------- Tokens ---------- */

interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  refresh_token_expires_in?: unknown;
}

function tokenFields(d: TokenResponse) {
  const now = Date.now();
  return {
    token: String(d.access_token),
    expiresAt: typeof d.expires_in === 'number' ? now + d.expires_in * 1000 : undefined,
    refreshToken: typeof d.refresh_token === 'string' ? d.refresh_token : undefined,
    refreshExpiresAt:
      typeof d.refresh_token_expires_in === 'number'
        ? now + d.refresh_token_expires_in * 1000
        : undefined,
  };
}

async function deviceProxy(
  body: Record<string, string>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(DEVICE_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  let data: Record<string, unknown> = {};
  try {
    const j: unknown = await res.json();
    if (j && typeof j === 'object') data = j as Record<string, unknown>;
  } catch {
    /* non-JSON: proxy not deployed */
  }
  return { status: res.status, data };
}

let refreshing: Promise<GitHubAuth> | null = null;

/** Single-flight: a refresh token works once, so concurrent callers share one refresh. */
function refreshAuth(auth: GitHubAuth): Promise<GitHubAuth> {
  if (!refreshing) {
    refreshing = doRefresh(auth).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function doRefresh(auth: GitHubAuth): Promise<GitHubAuth> {
  if (!auth.refreshToken || (auth.refreshExpiresAt && Date.now() > auth.refreshExpiresAt)) {
    throw signedOutError();
  }
  // Network errors propagate untouched so offline loads fall back to the cache.
  const { status, data } = await deviceProxy({
    action: 'refresh',
    refresh_token: auth.refreshToken,
  });
  if (typeof data.access_token === 'string') {
    const next: GitHubAuth = { ...auth, ...tokenFields(data) };
    saveGitHubAuth(next);
    return next;
  }
  if (status >= 500) throw new GitHubError(status, 'GitHub sign-in is unavailable right now.');
  // Another tab may have rotated the refresh token already.
  const current = getGitHubAuth();
  if (current && current.token !== auth.token) return current;
  throw signedOutError();
}

/** Current access token, refreshed first if it's about to expire. */
export async function getAccessToken(): Promise<string | null> {
  const auth = getGitHubAuth();
  if (!auth) return null;
  if (auth.expiresAt && Date.now() > auth.expiresAt - 5 * 60_000) {
    return (await refreshAuth(auth)).token;
  }
  return auth.token;
}

async function fetchLogin(token: string): Promise<string> {
  const res = await fetch(`${API}/user`, {
    headers: apiHeaders(token, 'application/vnd.github+json'),
    cache: 'no-store',
  });
  if (res.status === 401) throw new GitHubError(401, 'GitHub didn’t accept that token.');
  if (!res.ok) throw new GitHubError(res.status, await errorMessage(res));
  const j = (await res.json()) as { login?: unknown };
  return typeof j.login === 'string' ? j.login : 'GitHub user';
}

/** Validate and save a pasted personal access token. */
export async function signInWithToken(raw: string): Promise<GitHubAuth> {
  const token = raw.trim();
  if (!/^[A-Za-z0-9_]{20,}$/.test(token)) {
    throw new Error('That doesn’t look like a GitHub token.');
  }
  const login = await fetchLogin(token);
  const auth: GitHubAuth = { kind: 'pat', token, login };
  saveGitHubAuth(auth);
  return auth;
}

/* ---------- Device flow ---------- */

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type PollResult =
  | { kind: 'pending' }
  | { kind: 'slow_down'; interval: number }
  | { kind: 'done'; auth: GitHubAuth };

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}

const NOT_SET_UP = 'GitHub sign-in isn’t set up on this deployment yet. Use a token instead.';

function describeDeviceError(data: Record<string, unknown>, status: number): string {
  if (typeof data.error !== 'string') {
    // No JSON at all means the proxy function isn't deployed here.
    return status >= 400 && status < 500 ? NOT_SET_UP : `GitHub sign-in failed (HTTP ${status}).`;
  }
  switch (data.error) {
    case 'not_configured':
      return NOT_SET_UP;
    case 'expired_token':
      return 'That code expired. Try again.';
    case 'access_denied':
      return 'Sign-in was cancelled on GitHub.';
    case 'device_flow_disabled':
      return 'Device flow is turned off for the RunLines GitHub App. Enable it in the app’s settings.';
    case 'incorrect_client_credentials':
      return 'This deployment has the wrong GitHub client ID.';
    default:
      return typeof data.error_description === 'string' && data.error_description
        ? data.error_description
        : data.error;
  }
}

export async function startDeviceFlow(): Promise<DeviceCode> {
  const { status, data } = await deviceProxy({ action: 'start' });
  if (typeof data.device_code !== 'string' || typeof data.user_code !== 'string') {
    throw new Error(describeDeviceError(data, status));
  }
  const uri = typeof data.verification_uri === 'string' ? data.verification_uri : '';
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: uri.startsWith('https://github.com/') ? uri : DEFAULT_VERIFY_URI,
    expiresIn: num(data.expires_in, 900),
    interval: num(data.interval, 5),
  };
}

export async function pollDeviceFlow(deviceCode: string): Promise<PollResult> {
  const { status, data } = await deviceProxy({ action: 'poll', device_code: deviceCode });
  if (typeof data.access_token === 'string') {
    const fields = tokenFields(data);
    const login = await fetchLogin(fields.token);
    const auth: GitHubAuth = { kind: 'app', login, ...fields };
    saveGitHubAuth(auth);
    return { kind: 'done', auth };
  }
  if (data.error === 'authorization_pending') return { kind: 'pending' };
  if (data.error === 'slow_down') return { kind: 'slow_down', interval: num(data.interval, 10) };
  throw new Error(describeDeviceError(data, status));
}
