import { useState } from 'react';
import type { Beat } from '../types';
import type { Level } from '../lib/mask';
import { MaskedText } from './MaskedText';

interface FlashcardProps {
  beat: Beat;
  seed: number;
  level: Level;
  revealAll: boolean;
  resetKey: string;
}

export function Flashcard({ beat, seed, level, revealAll, resetKey }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((f) => !f);

  return (
    <div
      className={'flashcard' + (flipped ? ' flipped' : '')}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={flipped ? 'Line shown. Activate to hide.' : 'Cue shown. Activate to reveal line.'}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div className="fc-face fc-front">
        <div className="fc-tag">Cue</div>
        <p className={'fc-cue' + (beat.cue ? '' : ' none')}>
          {beat.cue || 'No cue — recall this beat from memory.'}
        </p>
        <div className="fc-hint">Tap card to reveal line →</div>
      </div>
      <div className="fc-face fc-back">
        <div className="fc-tag">Line</div>
        <div className="fc-line">
          <MaskedText
            text={beat.narrative}
            seed={seed}
            level={level}
            makeParas
            revealAll={revealAll}
            resetKey={resetKey}
          />
        </div>
        <div className="fc-hint">← Tap to hide</div>
      </div>
    </div>
  );
}
