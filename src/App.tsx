import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './state/store';
import { parseScript, toRaw } from './lib/parse';
import { getRecents, saveRecent, cacheScript, getCachedScript } from './lib/storage';
import type { Recent } from './types';
import { Loader } from './components/Loader';
import { Runner } from './components/Runner';

export function App() {
  const { state, dispatch } = useStore();
  const [recents, setRecents] = useState<Recent[]>(() => getRecents());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialUrl, setInitialUrl] = useState('');
  const reqRef = useRef(0);
  const inRunner = !!state.deck;

  const start = useCallback(
    (text: string, srcUrl?: string): boolean => {
      const deck = parseScript(text);
      if (!deck.beats.length) {
        setError(
          srcUrl ? 'Parsed OK but found no narrative lines.' : 'No lines found in that text.',
        );
        return false;
      }
      if (srcUrl) {
        saveRecent(deck.title, srcUrl);
        cacheScript(srcUrl, deck.title, text);
        setRecents(getRecents());
      }
      setError('');
      dispatch({ type: 'LOAD_DECK', deck });
      return true;
    },
    [dispatch],
  );

  const loadUrl = useCallback(
    async (input: string) => {
      setError('');
      const raw = toRaw(input);
      if (!/^https?:\/\//i.test(raw)) {
        setError('That doesn’t look like a URL.');
        return;
      }
      const token = ++reqRef.current;
      setLoading(true);
      try {
        const res = await fetch(raw, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status + (res.status === 404 ? ' — file not found' : ''));
        }
        const text = await res.text();
        if (token !== reqRef.current) return; // superseded by a newer load
        start(text, input.trim());
      } catch (err) {
        if (token !== reqRef.current) return;
        // Offline / fetch failed → fall back to a cached copy if we have one.
        const cached = getCachedScript(input.trim());
        if (cached) {
          if (start(cached.text, input.trim())) {
            setError('');
            return;
          }
        }
        setError('Could not load: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        if (token === reqRef.current) setLoading(false);
      }
    },
    [start],
  );

  // Deep link: ?url= or #url=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const u =
      params.get('url') ||
      (location.hash.startsWith('#url=') ? decodeURIComponent(location.hash.slice(5)) : '');
    if (u) {
      setInitialUrl(u);
      loadUrl(u);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToLoader = () => {
    reqRef.current++;
    setLoading(false);
    setRecents(getRecents());
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
