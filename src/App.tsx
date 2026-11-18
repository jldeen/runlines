import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './state/store';
import { parseScript, toRaw } from './lib/parse';
import {
  getRecents,
  saveRecent,
  cacheScript,
  getGitHubAuth,
  clearGitHubAuth,
  onGitHubAuthChange,
} from './lib/storage';
import {
  GitHubError,
  cleanSourceUrl,
  isUnreachable,
  loadScript,
  noAccessHint,
  notFoundHint,
  parseGitHubUrl,
  type GitHubLocation,
} from './lib/github';
import { sourceFromLocation, withSource } from './lib/deeplink';
import type { GitHubAuth, Recent } from './types';
import { Loader } from './components/Loader';
import { Runner } from './components/Runner';

function describeLoadError(err: unknown, loc: GitHubLocation | null): string {
  if (err instanceof GitHubError) {
    const auth = getGitHubAuth();
    if (err.status === 404 && loc) {
      return auth
        ? notFoundHint(auth, loc)
        : 'HTTP 404 — file not found. If it’s in a private repo, sign in to GitHub below first.';
    }
    if (err.status === 403 && loc && auth && !/rate limit/i.test(err.message)) {
      return noAccessHint(auth, loc);
    }
    if (err.status === 401) return err.message;
    return 'Could not load: ' + err.message;
  }
  if (isUnreachable(err)) {
    return 'Couldn’t reach the script. Check your connection and try again. (No saved copy of it on this device yet.)';
  }
  return 'Could not load: ' + (err instanceof Error ? err.message : String(err));
}

/** Point the address bar at the open script, so a reload re-fetches it. */
function rememberSource(src: string | null): void {
  try {
    const next = withSource(location.href, src);
    if (next !== location.href) history.replaceState(history.state, '', next);
  } catch {
    /* history unavailable — reload just shows the loader */
  }
}

export function App() {
  const { state, dispatch } = useStore();
  const [recents, setRecents] = useState<Recent[]>(() => getRecents());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Read the deep link up front so the Loader's URL field starts with it.
  const [initialUrl] = useState(() => sourceFromLocation(location));
  const [ghAuth, setGhAuth] = useState<GitHubAuth | null>(() => getGitHubAuth());
  const reqRef = useRef(0);
  const inRunner = !!state.deck;

  // Keep every open tab in step when one signs in, signs out, or refreshes.
  useEffect(() => onGitHubAuthChange(() => setGhAuth(getGitHubAuth())), []);

  const start = useCallback(
    (text: string, srcUrl?: string, savedCopy?: { at?: number }): boolean => {
      const deck = parseScript(text);
      if (!deck.beats.length) {
        setError(
          srcUrl ? 'Parsed OK but found no narrative lines.' : 'No lines found in that text.',
        );
        return false;
      }
      if (srcUrl) {
        saveRecent(deck.title, srcUrl);
        // Re-saving a saved copy would stamp it as new.
        if (!savedCopy) cacheScript(srcUrl, deck.title, text);
        setRecents(getRecents());
      }
      rememberSource(srcUrl ?? null);
      setError('');
      dispatch({ type: 'LOAD_DECK', deck, savedCopy: savedCopy ?? null });
      return true;
    },
    [dispatch],
  );

  const loadUrl = useCallback(
    async (input: string) => {
      setError('');
      // Fetch with the link as pasted (a private raw link's ?token= still works),
      // but save/cache it without the token.
      const src = cleanSourceUrl(input);
      const raw = toRaw(input.trim());
      if (!/^https?:\/\//i.test(raw)) {
        setError('That doesn’t look like a URL.');
        return;
      }
      const loc = parseGitHubUrl(src);
      const token = ++reqRef.current;
      setLoading(true);
      try {
        // Always the live file; the saved copy only when the script can't be reached.
        const { text, saved } = await loadScript(raw, src, loc);
        if (token !== reqRef.current) return; // superseded by a newer load
        start(text, src, saved);
      } catch (err) {
        if (token !== reqRef.current) return;
        setError(describeLoadError(err, loc));
      } finally {
        // An expired/revoked sign-in clears the saved token; reflect that.
        setGhAuth(getGitHubAuth());
        if (token === reqRef.current) setLoading(false);
      }
    },
    [start],
  );

  // Deep link: ?url= or #url=
  useEffect(() => {
    if (initialUrl) loadUrl(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToLoader = () => {
    reqRef.current++;
    setLoading(false);
    setRecents(getRecents());
    rememberSource(null);
    dispatch({ type: 'RESET' });
  };

  return (
    <>
      <header>
        <div className="brand">
          <div style={{ minWidth: 0 }}>
            <h1>
              Run<span>Lines</span>
            </h1>
            {inRunner && <div className="doc-title">{state.deck!.title}</div>}
          </div>
          {inRunner && (
            <button type="button" className="iconbtn" onClick={backToLoader}>
              ↻ New script
            </button>
          )}
        </div>
      </header>

      <main className={inRunner ? 'in-runner' : ''}>
        {inRunner ? (
          <Runner />
        ) : (
          <Loader
            initialUrl={initialUrl}
            recents={recents}
            error={error}
            loading={loading}
            githubAuth={ghAuth}
            onGitHubSignedIn={setGhAuth}
            onGitHubSignOut={() => {
              clearGitHubAuth();
              setGhAuth(null);
            }}
            onLoadUrl={loadUrl}
            onPaste={(t) => {
              if (!t.trim()) {
                setError('Paste something first.');
                return;
              }
              start(t);
            }}
          />
        )}
        {!inRunner && (
          <div className="footer">
            Tap any faded word to peek · score your recall after each beat · works offline
          </div>
        )}
      </main>
    </>
  );
}
