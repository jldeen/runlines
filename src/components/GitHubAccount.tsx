import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GitHubAuth } from '../types';
import {
  githubSignInEnabled,
  pollDeviceFlow,
  signInWithToken,
  startDeviceFlow,
  type DeviceCode,
} from '../lib/github';
import { Dialog } from './Dialog';

const OFFLINE_MSG = 'Couldn’t reach GitHub. Check your connection and try again.';

function message(e: unknown): string {
  if (e instanceof TypeError) return OFFLINE_MSG;
  return e instanceof Error ? e.message : String(e);
}

interface GitHubAccountProps {
  auth: GitHubAuth | null;
  onSignedIn: (auth: GitHubAuth) => void;
  onSignOut: () => void;
}

/** Signed-in status, or "Sign in with GitHub" plus a paste-a-token fallback. */
export function GitHubAccount({ auth, onSignedIn, onSignOut }: GitHubAccountProps) {
  const [deviceOpen, setDeviceOpen] = useState(false);

  if (auth) {
    return (
      <div className="gh-account">
        <span>
          {auth.kind === 'app' ? 'Signed in to GitHub as ' : 'Using a GitHub token for '}
          <strong>@{auth.login}</strong>
        </span>
        <button type="button" className="linkbtn" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="gh-signin">
      {githubSignInEnabled && (
        <>
          <button type="button" className="btn secondary" onClick={() => setDeviceOpen(true)}>
            Sign in with GitHub
          </button>
          <div className="hint">
            For scripts in private repos. RunLines can only read the repos you allow.
          </div>
        </>
      )}
      <TokenForm
        summary={githubSignInEnabled ? 'Or use a GitHub token instead' : 'Private repo? Use a GitHub token'}
        onSignedIn={onSignedIn}
      />
      <Dialog open={deviceOpen} onClose={() => setDeviceOpen(false)} labelledBy="ghTitle">
        <DeviceFlow
          onClose={() => setDeviceOpen(false)}
          onSignedIn={(a) => {
            setDeviceOpen(false);
            onSignedIn(a);
          }}
        />
      </Dialog>
    </div>
  );
}

function TokenForm({
  summary,
  onSignedIn,
}: {
  summary: string;
  onSignedIn: (auth: GitHubAuth) => void;
}) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const a = await signInWithToken(token);
      setToken('');
      onSignedIn(a);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <details>
      <summary>{summary}</summary>
      <form className="field" style={{ marginTop: 10 }} onSubmit={save}>
        <label htmlFor="ghToken">Fine-grained personal access token</label>
        <input
          type="password"
          id="ghToken"
          placeholder="github_pat_…"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="hint">
          Create one at{' '}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/settings/personal-access-tokens
          </a>
          : <em>Only select repositories</em> (your scripts repo) and{' '}
          <em>Contents: Read-only</em>. It’s saved on this device only.
        </div>
        {error ? <div className="err">{error}</div> : null}
        <button type="submit" className="btn secondary" disabled={busy || !token.trim()}>
          {busy ? 'Checking…' : 'Save token'}
        </button>
      </form>
    </details>
  );
}

/** Device flow: show a code, the user approves it on github.com, we poll until done. */
function DeviceFlow({
  onClose,
  onSignedIn,
}: {
  onClose: () => void;
  onSignedIn: (auth: GitHubAuth) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const signedInRef = useRef(onSignedIn);
  signedInRef.current = onSignedIn;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let device: DeviceCode | null = null;
    let interval = 5;
    let deadline = 0;
    let lastPoll = 0;
    let busy = false;
    setCode(null);
    setError('');
    setCopied(false);

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, interval * 1000);
    };

    const poll = async () => {
      if (cancelled || busy || !device) return;
      window.clearTimeout(timer);
      if (Date.now() > deadline) {
        setError('That code expired. Try again.');
        return;
      }
      busy = true;
      lastPoll = Date.now();
      try {
        const r = await pollDeviceFlow(device.deviceCode);
        if (cancelled) return;
        if (r.kind === 'done') {
          signedInRef.current(r.auth);
          return;
        }
        if (r.kind === 'slow_down') interval = r.interval;
        schedule();
      } catch (e) {
        if (cancelled) return;
        // Network blip (e.g. switching apps on a phone) — keep waiting.
        if (e instanceof TypeError) schedule();
        else setError(message(e));
      } finally {
        busy = false;
      }
    };

    // Poll right away when the user comes back from approving on GitHub.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastPoll >= interval * 1000) {
        poll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    startDeviceFlow()
      .then((d) => {
        if (cancelled) return;
        device = d;
        interval = d.interval;
        deadline = Date.now() + d.expiresIn * 1000;
        lastPoll = Date.now();
        setCode(d);
        schedule();
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [attempt]);

  const copy = () => {
    if (!code) return;
    navigator.clipboard?.writeText(code.userCode).then(
      () => setCopied(true),
      () => {},
    );
  };

  return (
    <>
      <h2 id="ghTitle">Sign in with GitHub</h2>
      {error ? (
        <>
          <div className="err">{error}</div>
          <div className="row2" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
            <button type="button" className="btn secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      ) : !code ? (
        <>
          <p className="sub">Getting a sign-in code…</p>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <p className="sub">
            Enter this code on GitHub and approve RunLines, then come back here. Sign-in finishes on
            its own.
          </p>
          <div className="device-code" aria-label={`Code ${code.userCode.split('').join(' ')}`}>
            {code.userCode}
          </div>
          <a
            className="btn"
            href={code.verificationUri}
            target="_blank"
            rel="noopener noreferrer"
            onClick={copy}
          >
            Copy code &amp; open GitHub
          </a>
          <div className="hint device-status" role="status">
            {copied ? '✓ Code copied. ' : ''}Waiting for you to approve on GitHub…
          </div>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
        </>
      )}
    </>
  );
}
