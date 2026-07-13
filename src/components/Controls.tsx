import type { ScoreVal, ViewMode } from '../types';
import { LEVELS } from '../lib/mask';
import { ScoreBox } from './ScoreBox';

interface ControlsProps {
  viewMode: ViewMode;
  onView: (v: ViewMode) => void;
  scoreValue: ScoreVal | null;
  onScore: (v: ScoreVal) => void;
  flashToken: number;
  level: number;
  onLevel: (n: number) => void;
  shuffled: boolean;
  onStartOver: () => void;
  onCover: () => void;
  onRevealAll: () => void;
  onShuffle: () => void;
  onSpeak: () => void;
  onTeleprompter: () => void;
  onSummary: () => void;
  onExport: () => void;
}

const MODES: { m: ViewMode; label: string }[] = [
  { m: 'lines', label: '📄 Lines' },
  { m: 'bullets', label: '• Bullets' },
  { m: 'cards', label: '🃏 Cards' },
];

export function Controls(p: ControlsProps) {
  return (
    <div className="controls">
      <div className="modebar" role="group" aria-label="Study mode">
        {MODES.map((o) => (
          <button
            key={o.m}
            type="button"
            className={'modebtn' + (p.viewMode === o.m ? ' sel' : '')}
            aria-pressed={p.viewMode === o.m}
            onClick={() => p.onView(o.m)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <ScoreBox value={p.scoreValue} onScore={p.onScore} flashToken={p.flashToken} />

      <div className="levelrow">
        <label htmlFor="level">Fade</label>
        <input
          type="range"
          id="level"
          min={0}
          max={5}
          step={1}
          value={p.level}
          aria-valuetext={LEVELS[p.level].n}
          onChange={(e) => p.onLevel(+e.target.value)}
        />
        <span className="lvl-name">{LEVELS[p.level].n}</span>
      </div>

      <div className="toolbtns">
        <button type="button" className="iconbtn" onClick={p.onStartOver}>
          ⏮ Start over
        </button>
        <button type="button" className="iconbtn" onClick={p.onCover}>
          🙈 Cover
        </button>
        <button type="button" className="iconbtn" onClick={p.onRevealAll}>
          👁 Reveal all
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-pressed={p.shuffled}
          onClick={p.onShuffle}
        >
          {p.shuffled ? '➡️ In order' : '🔀 Shuffle'}
        </button>
        <button type="button" className="iconbtn" onClick={p.onSpeak}>
          🔊 Cue voice
        </button>
        <button type="button" className="iconbtn" onClick={p.onTeleprompter}>
          🎬 Teleprompter
        </button>
        <button type="button" className="iconbtn" onClick={p.onSummary}>
          📊 Summary
        </button>
        <button type="button" className="iconbtn" onClick={p.onExport}>
          📇 Export cards
        </button>
      </div>
    </div>
  );
}
