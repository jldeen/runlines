import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck, TpStyle, ViewMode } from '../types';
import { segmentSentences } from '../lib/segment';
import { getTpPrefs, saveTpPrefs } from '../lib/storage';

interface TeleprompterProps {
  open: boolean;
  deck: Deck;
  viewMode: ViewMode;
  onClose: () => void;
}

// Pixels-per-second at speed 1.0 (refresh-rate independent).
const PX_PER_SEC = 60;

export function Teleprompter({ open, deck, viewMode, onClose }: TeleprompterProps) {
  const init = getTpPrefs();
  const [speed, setSpeed] = useState(init.speed);
  const [size, setSize] = useState(init.size);
  const [style, setStyle] = useState<TpStyle>(init.style);
  const [mirror, setMirror] = useState(init.mirror);
  const [playing, setPlaying] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const posRef = useRef(0);
  const lastTsRef = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Persist prefs.
  useEffect(() => {
    saveTpPrefs({ speed, size, style, mirror });
  }, [speed, size, style, mirror]);

  // When opened, default style to the active practice view and reset scroll.
  useEffect(() => {
    if (!open) return;
    setStyle(viewMode === 'bullets' ? 'bullets' : 'lines');
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    posRef.current = 0;
    setPlaying(false);
  }, [open, viewMode]);

  // rAF scroll loop, timestamp-based so speed is the same at any refresh rate.
  useEffect(() => {
    if (!open || !playing) return;
    lastTsRef.current = 0;
    const step = (ts: number) => {
      const el = scrollRef.current;
      if (!el) return;
      if (lastTsRef.current === 0) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      posRef.current += speedRef.current * PX_PER_SEC * dt;
      el.scrollTop = posRef.current;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [open, playing]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && scrollRef.current) posRef.current = scrollRef.current.scrollTop;
      return !p;
    });
  }, []);

  const restart = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    posRef.current = 0;
  }, []);

  // Keyboard while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSpeed((s) => Math.max(0.2, +(s - 0.2).toFixed(1)));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSpeed((s) => Math.min(6, +(s + 0.2).toFixed(1)));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, toggle]);

  if (!open) return null;

  return (
    <div
      className={'tp open' + (mirror ? ' mirror' : '')}
      role="dialog"
      aria-modal="true"
      aria-label="Teleprompter"
    >
      <div className="tp-top">
        <div className="t">{deck.title || 'Teleprompter'}</div>
        <button type="button" className="iconbtn" onClick={onClose}>
          ✕ Close
        </button>
      </div>

      <div className="tp-scroll" ref={scrollRef} style={{ ['--tp-size' as string]: size + 'px' }}>
        <div className="tp-inner" onClick={toggle}>
          {deck.beats.map((b, i) => (
            <div className="tp-beat" key={i}>
              {b.cue ? <div className="tp-cue">{b.cue}</div> : null}
              {style === 'bullets' ? (
                <ul className="tp-bullets">
                  {segmentSentences(b.narrative).map((s, si) => (
                    <li key={si}>{s}</li>
                  ))}
                </ul>
              ) : (
                b.narrative
                  .split(/\n+/)
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l, li) => (
                    <p className="tp-line" key={li}>
                      {l}
                    </p>
                  ))
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="tp-bottom">
        <button type="button" className="iconbtn tp-play" aria-pressed={playing} onClick={toggle}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button type="button" className="iconbtn" onClick={restart}>
          ⏮ Top
        </button>
        <div className="grp">
          <button
            type="button"
            className="iconbtn"
            aria-label="Slower"
            onClick={() => setSpeed((s) => Math.max(0.2, +(s - 0.2).toFixed(1)))}
          >
            − Speed
          </button>
          <span className="val">{speed.toFixed(1)}×</span>
          <button
            type="button"
            className="iconbtn"
            aria-label="Faster"
            onClick={() => setSpeed((s) => Math.min(6, +(s + 0.2).toFixed(1)))}
          >
            + Speed
          </button>
        </div>
        <div className="grp">
          <button
            type="button"
            className="iconbtn"
            aria-label="Smaller text"
            onClick={() => setSize((s) => Math.max(20, s - 4))}
          >
            − Size
          </button>
          <span className="val">{size}px</span>
          <button
            type="button"
            className="iconbtn"
            aria-label="Bigger text"
            onClick={() => setSize((s) => Math.min(96, s + 4))}
          >
            + Size
          </button>
        </div>
        <div className="seg" role="group" aria-label="Text style">
          <button
            type="button"
            className={style === 'lines' ? 'on' : ''}
            aria-pressed={style === 'lines'}
            onClick={() => setStyle('lines')}
          >
            Lines
          </button>
          <button
            type="button"
            className={style === 'bullets' ? 'on' : ''}
            aria-pressed={style === 'bullets'}
            onClick={() => setStyle('bullets')}
          >
            Bullets
          </button>
        </div>
        <div className="seg" role="group" aria-label="Orientation">
          <button
            type="button"
            className={!mirror ? 'on' : ''}
            aria-pressed={!mirror}
            onClick={() => setMirror(false)}
          >
            Normal
          </button>
          <button
            type="button"
            className={mirror ? 'on' : ''}
            aria-pressed={mirror}
            onClick={() => setMirror(true)}
          >
            🪞 Mirror
          </button>
        </div>
      </div>
    </div>
  );
}
