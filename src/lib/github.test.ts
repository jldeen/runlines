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

describe('loading a script', () => {
  const SRC = 'https://github.com/octo/scripts/blob/main/demo.sk';
  const RAW = 'https://raw.githubusercontent.com/octo/scripts/main/demo.sk';
  const SAVED_AT = Date.UTC(2026, 10, 16, 18, 30);

  function saveCopy() {
    localStorage.setItem(
      'runlines.cache',
      JSON.stringify({ [SRC]: { url: SRC, title: 'Demo', text: 'old copy', at: SAVED_AT } }),
    );
  }

  /** Answer the contents API with `api` and the raw URL with `raw` (status or thrown error). */
  function serve(api: number | Error, raw: number | Error = 404) {
    const reply = (r: number | Error) => {
      if (r instanceof Error) throw r;
      return r === 200 ? new Response('live copy') : json({ message: 'nope' }, r);
    };
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      reply(String(url).startsWith('https://api.github.com/') ? api : raw),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  async function load() {
    const gh = await tab();
    return gh.loadScript(RAW, SRC, gh.parseGitHubUrl(SRC));
  }

  it.each([
    ['signed out, private repo', 404, false],
    ['signed in, no access', 403, true],
    ['signed in, wrong link or repo not shared', 404, true],
    ['sign-in revoked', 401, true],
  ])('shows the real error instead of the saved copy: %s', async (_, status, signedIn) => {
    if (signedIn) save({ kind: 'pat', expiresAt: undefined, refreshToken: undefined });
    saveCopy();
    serve(status);

    await expect(load()).rejects.toMatchObject({ status });
  });

  it.each([
    ['offline', new TypeError('Failed to fetch'), new TypeError('Failed to fetch')],
    ['GitHub down', 503, 502],
  ])('uses the saved copy, with its date, only when GitHub is unreachable: %s', async (_, api, raw) => {
    saveCopy();
    serve(api, raw);

    await expect(load()).resolves.toEqual({ text: 'old copy', saved: { at: SAVED_AT } });
  });

  it('fails when offline with no saved copy', async () => {
    serve(new TypeError('Failed to fetch'), new TypeError('Failed to fetch'));

    await expect(load()).rejects.toBeInstanceOf(TypeError);
  });

  it('reads the latest commit through the contents API, never from a browser or CDN cache', async () => {
    saveCopy();
    const fetchMock = serve(200, 200);

    await expect(load()).resolves.toEqual({ text: 'live copy' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.github.com/repos/octo/scripts/contents/demo.sk?ref=main');
    expect(init?.cache).toBe('no-store');
  });

  it('falls back to the raw link when the anonymous API is rate-limited', async () => {
    const fetchMock = serve(429, 200);

    await expect(load()).resolves.toEqual({ text: 'live copy' });
    expect(fetchMock.mock.calls.map(([, init]) => init?.cache)).toEqual([
      'no-store',
      'no-store',
    ]);
  });
});
