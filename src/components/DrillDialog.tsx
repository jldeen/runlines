import { useEffect, useRef, useState } from 'react';
import type { Beat } from '../types';
import { Dialog } from './Dialog';

interface DrillDialogProps {
  open: boolean;
  beats: Beat[]; // in the active practice order
  onClose: () => void;
}

const REVEAL_MS = 2600;

/**
 * Hands-free drill: speaks each beat's stage cue aloud, gives you N seconds to
 * deliver the line from memory, reveals it to self-check, then auto-advances.
 */
export function DrillDialog({ open, beats, onClose }: DrillDialogProps) {
  const [secs, setSecs] = useState(6);
  const [speakCue, setSpeakCue] = useState(true);
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<'cue' | 'reveal'>('cue');
  const [remaining, setRemaining] = useState(0);
  const secsRef = useRef(secs);
  secsRef.current = secs;

  const speak = (text: string) => {
    if (!speakCue || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      speechSynthesis.speak(u);
    } catch {
      /* speech unavailable */
    }
  };

  // Reset when opened/closed.
  useEffect(() => {
    if (open) {
      setPos(0);
      setPhase('cue');
      setRunning(false);
      setRemaining(secsRef.current);
    } else {
      setRunning(false);
      try {
        speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }, [open]);

  // Kick off a beat's cue phase.
  useEffect(() => {
    if (!open || !running || phase !== 'cue') return;
    setRemaining(secsRef.current);
    speak(beats[pos]?.cue || 'Your line.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running, phase, pos]);

  // Countdown / phase machine.
  useEffect(() => {
    if (!open || !running) return;
    if (phase === 'cue') {
      if (remaining <= 0) {
        setPhase('reveal');
        return;
      }
      const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
      return () => window.clearTimeout(id);
    }
    // reveal phase → hold, then advance
    const id = window.setTimeout(() => {
      if (pos + 1 >= beats.length) {
        setRunning(false);
      } else {
        setPos((p) => p + 1);
        setPhase('cue');
      }
    }, REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [open, running, phase, remaining, pos, beats.length]);

  const beat = beats[pos];
  const done = !running && pos + 1 >= beats.length && phase === 'reveal';

  return (
    <Dialog open={open} onClose={onClose} labelledBy="drillTitle">
      <h2 id="drillTitle">Cue-only drill</h2>
      <p className="sub">
        Beat {beats.length ? pos + 1 : 0} / {beats.length} · hands-free — hear the cue, say your
        line, then it reveals.
      </p>

      <div className="drill-stage">
        <div className="drill-cue">{beat?.cue || 'No cue — go by memory.'}</div>
        {running && phase === 'cue' && <div className="drill-count">{remaining}</div>}
        {phase === 'reveal' && <div className="drill-line">{beat?.narrative}</div>}
        {done && <div className="drill-done">Drill complete 🎉</div>}
      </div>

      <div className="row2" style={{ marginTop: 12 }}>
        {!running ? (
          <button
            type="button"
            className="btn"
            disabled={!beats.length}
            onClick={() => {
              if (done) {
                setPos(0);
              }
              setPhase('cue');
              setRunning(true);
            }}
          >
            ▶ {done ? 'Restart' : pos > 0 ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button type="button" className="btn secondary" onClick={() => setRunning(false)}>
            ⏸ Pause
          </button>
        )}
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            setRunning(false);
            setPos(0);
            setPhase('cue');
          }}
        >
          ↺ Reset
        </button>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="drillSecs">Seconds per line: {secs}</label>
        <input
          type="range"
          id="drillSecs"
          min={3}
          max={20}
          step={1}
          value={secs}
          onChange={(e) => setSecs(+e.target.value)}
        />
      </div>
      <label className="checkline" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={speakCue} onChange={(e) => setSpeakCue(e.target.checked)} />
        Speak the cue aloud
      </label>

      <div className="row2" style={{ marginTop: 16 }}>
        <button type="button" className="btn secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
