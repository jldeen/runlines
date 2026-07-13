import { useEffect, useRef, useState } from 'react';

/** Parse a target like "~35s", "1m20s", "2 min" into seconds, or 0 if none. */
export function parseTargetSeconds(time: string): number {
  if (!time) return 0;
  const t = time.toLowerCase();
  let secs = 0;
  const m = t.match(/(\d+)\s*m/);
  const s = t.match(/(\d+)\s*s/);
  if (m) secs += parseInt(m[1], 10) * 60;
  if (s) secs += parseInt(s[1], 10);
  if (!m && !s) {
    const n = t.match(/(\d+(\.\d+)?)/);
    if (n) secs = Math.round(parseFloat(n[1]));
  }
  return secs;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/**
 * Live per-beat delivery timer. Auto-resets whenever `resetKey` changes (i.e. on
 * navigation) and compares elapsed time against the beat's target. A single
 * always-on interval reads mutable refs so play/pause never desyncs.
 */
export function PaceTimer({ target, resetKey }: { target: string; resetKey: string }) {
  const targetSec = parseTargetSeconds(target);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  const accumRef = useRef(0); // ms accumulated while previously running
  const startRef = useRef<number | null>(Date.now()); // epoch of current run, or null when paused

  const compute = () =>
    accumRef.current + (startRef.current != null ? Date.now() - startRef.current : 0);

  // Reset on beat change.
  useEffect(() => {
    accumRef.current = 0;
    startRef.current = Date.now();
    setRunning(true);
    setElapsed(0);
  }, [resetKey]);

  // One interval for the component's lifetime.
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Math.floor(compute() / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const toggle = () => {
    if (startRef.current != null) {
      accumRef.current += Date.now() - startRef.current;
      startRef.current = null;
      setRunning(false);
    } else {
      startRef.current = Date.now();
      setRunning(true);
    }
    setElapsed(Math.floor(compute() / 1000));
  };
  const reset = () => {
    accumRef.current = 0;
    startRef.current = Date.now();
    setRunning(true);
    setElapsed(0);
  };

  let cls = 'pace';
  let hint = '';
  if (targetSec > 0) {
    if (elapsed > targetSec * 1.15) {
      cls += ' over';
      hint = ` · +${fmt(elapsed - targetSec)}`;
    } else if (elapsed >= targetSec * 0.85) {
      cls += ' good';
      hint = ' · on pace ✓';
    } else if (running) {
      cls += ' onpace';
    }
  }

  return (
    <span className={cls}>
      <button
        type="button"
        className="pace-btn"
        onClick={toggle}
        aria-label={running ? 'Pause pace timer' : 'Resume pace timer'}
        title={running ? 'Pause' : 'Resume'}
      >
        {running ? '⏸' : '▶'}
      </button>
      <span className="pace-time">
        {fmt(elapsed)}
        {targetSec > 0 ? ` / ${fmt(targetSec)}` : ''}
        {hint}
      </span>
      <button
        type="button"
        className="pace-btn"
        onClick={reset}
        aria-label="Reset pace timer"
        title="Reset"
      >
        ↺
      </button>
    </span>
  );
}
