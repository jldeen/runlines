import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubAuth } from '../types';

const KEY = 'runlines.github';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

function save(over: Partial<GitHubAuth> = {}) {
  const auth: GitHubAuth = {
    kind: 'app',
    login: 'octo',
    token: 'ghu_old',
    refreshToken: 'ghr_old',
    expiresAt: Date.now() - 1000,
    refreshExpiresAt: Date.now() + 1e9,
    ...over,
  };
  localStorage.setItem(KEY, JSON.stringify(auth));
}

const saved = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const newTokens = {
  access_token: 'ghu_new',
  expires_in: 28800,
  refresh_token: 'ghr_new',
  refresh_token_expires_in: 15897600,
};

/** A fresh copy of the module: like another browser tab sharing the same localStorage. */
async function tab() {
  vi.resetModules();
  return import('./github');
}

/** Minimal Web Locks (one holder per name, first come first served), so tests don't depend on Node's. */
function memoryLocks() {
  const tails = new Map<string, Promise<unknown>>();
  return {
    request<T>(name: string, cb: () => Promise<T>): Promise<T> {
      const run = (tails.get(name) ?? Promise.resolve()).then(cb);
      tails.set(name, run.catch(() => {}));
      return run;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('navigator', { locks: memoryLocks() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GitHub sign-in refresh', () => {
  it('spends the refresh token once when two tabs refresh at the same time', async () => {
    save();
    const spent = new Set<string>();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { refresh_token } = JSON.parse(String(init?.body));
      await new Promise((r) => setTimeout(r, 10));
      if (spent.has(refresh_token)) return json({ error: 'incorrect_client_credentials' });
      spent.add(refresh_token);
      return json(newTokens);
    });
    vi.stubGlobal('fetch', fetchMock);
    const [a, b] = [await tab(), await tab()];

    await expect(Promise.all([a.getAccessToken(), b.getAccessToken()])).resolves.toEqual([
      'ghu_new',
      'ghu_new',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saved()).toMatchObject({ token: 'ghu_new', refreshToken: 'ghr_new' });
  });

  it('keeps the sign-in when a refresh fails for a reason other than revocation', async () => {
    save();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Too many requests', { status: 429 })));
    const gh = await tab();

    await expect(gh.getAccessToken()).rejects.toMatchObject({ status: 503 });
    expect(saved()).toMatchObject({ token: 'ghu_old', refreshToken: 'ghr_old' });
  });

  it('signs out when GitHub rejects the refresh token', async () => {
    save();
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'incorrect_client_credentials' })));
    const gh = await tab();

    await expect(gh.getAccessToken()).rejects.toMatchObject({ status: 401 });
    expect(saved()).toBeNull();
  });

  it('retries with a token another tab rotated in instead of refreshing again', async () => {
    save({ expiresAt: Date.now() + 3_600_000 });
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!String(url).startsWith('https://api.github.com/')) return json(newTokens);
      const auth = new Headers(init?.headers).get('Authorization');
      if (auth === 'Bearer ghu_new') return new Response('script text');
      save({ token: 'ghu_new', refreshToken: 'ghr_new', expiresAt: Date.now() + 3_600_000 });
      return json({ message: 'Bad credentials' }, 401);
    });
    vi.stubGlobal('fetch', fetchMock);
    const gh = await tab();

    await expect(
      gh.fetchGitHubFile({ owner: 'octo', repo: 'scripts', candidates: [{ path: ['a.sk'] }] }),
    ).resolves.toBe('script text');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(saved()).toMatchObject({ token: 'ghu_new' });
  });

  it('keeps a just-issued token that GitHub is slow to accept, without refreshing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    save({ issuedAt: Date.now(), expiresAt: Date.now() + 3_600_000 });
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).startsWith('https://api.github.com/')
        ? json({ message: 'Bad credentials' }, 401)
        : json(newTokens),
    );
    vi.stubGlobal('fetch', fetchMock);
    const gh = await tab();

    const load = gh.fetchGitHubFile({ owner: 'o', repo: 'r', candidates: [{ path: ['a.sk'] }] });
    const settled = expect(load).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await settled;
    expect(fetchMock.mock.calls.every(([u]) => String(u).startsWith('https://api.github.com/'))).toBe(true);
    expect(saved()).toMatchObject({ token: 'ghu_old', refreshToken: 'ghr_old' });
  });
});
