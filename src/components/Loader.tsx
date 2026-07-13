import { useState } from 'react';
import type { Recent } from '../types';
import { isCached } from '../lib/storage';

interface LoaderProps {
  initialUrl: string;
  recents: Recent[];
  error: string;
  loading: boolean;
  onLoadUrl: (url: string) => void;
  onPaste: (text: string) => void;
}

export function Loader({ initialUrl, recents, error, loading, onLoadUrl, onPaste }: LoaderProps) {
  const [url, setUrl] = useState(initialUrl);
  const [paste, setPaste] = useState('');

  return (
    <section className="loader">
      <div className="field">
        <label htmlFor="url">
          GitHub link to a <code>.sk</code> script
        </label>
        <input
          type="text"
          id="url"
          placeholder="https://github.com/user/repo/blob/main/keynote/part-a.sk"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onLoadUrl(url);
          }}
        />
        <div className="hint">Paste a normal GitHub file URL — I convert it to raw automatically.</div>
      </div>
      <div className="row2">
        <button type="button" className="btn" disabled={loading} onClick={() => onLoadUrl(url)}>
          {loading ? 'Loading…' : 'Load script'}
        </button>
      </div>
      {error ? (
        <div className="err" style={{ display: 'block' }}>
          {error}
        </div>
      ) : null}

      <details>
        <summary>Or paste raw JSON / plain text instead</summary>
        <div className="field" style={{ marginTop: 10 }}>
          <textarea
            placeholder="Paste .sk JSON, or plain narrative text…"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button type="button" className="btn secondary" onClick={() => onPaste(paste)}>
            Use pasted text
          </button>
        </div>
      </details>

      {recents.length > 0 && (
        <div className="recents">
          <label>Recent scripts</label>
          {recents.map((x) => (
            <button
              type="button"
              className="recent"
              key={x.url}
              onClick={() => {
                setUrl(x.url);
                onLoadUrl(x.url);
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong>{x.title}</strong>
                <small>{x.url}</small>
              </div>
              {isCached(x.url) ? (
                <span className="offline-tag" title="Saved for offline use">
                  ✓ offline
                </span>
              ) : (
                <span aria-hidden="true">›</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
