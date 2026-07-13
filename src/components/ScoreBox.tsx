import { useEffect, useRef } from 'react';
import type { ScoreVal } from '../types';

interface ScoreBoxProps {
  value: ScoreVal | null;
  onScore: (v: ScoreVal) => void;
  flashToken: number;
}

const OPTIONS: { v: ScoreVal; label: string }[] = [
  { v: 'got', label: '✅ Got it' },
  { v: 'shaky', label: '🟡 Shaky' },
  { v: 'missed', label: '❌ Missed' },
];

export function ScoreBox({ value, onScore, flashToken }: ScoreBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flashToken === 0) return;
    const box = boxRef.current;
    if (!box) return;
    box.classList.remove('flash');
    void box.offsetWidth;
    box.classList.add('flash');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [flashToken]);

  return (
    <div className="scorebox" ref={boxRef}>
      <h3 id="scoreHeading">How'd I do?</h3>
      <div className="scorebtns" role="group" aria-labelledby="scoreHeading">
        {OPTIONS.map((o) => (
          <button
            key={o.v}
            type="button"
            className={'scorebtn' + (value === o.v ? ' sel' : '')}
            data-v={o.v}
            aria-pressed={value === o.v}
            onClick={() => onScore(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
