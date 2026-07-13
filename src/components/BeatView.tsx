import type { Beat, ViewMode } from '../types';
import type { Level } from '../lib/mask';
import { segmentSentences } from '../lib/segment';
import { MaskedText } from './MaskedText';
import { Flashcard } from './Flashcard';

interface BeatViewProps {
  beat: Beat;
  origIndex: number;
  viewMode: ViewMode;
  level: Level;
  revealAll: boolean;
}

export function BeatView({ beat, origIndex, viewMode, level, revealAll }: BeatViewProps) {
  const resetKey = `${origIndex}|${level.n}|${viewMode}|${revealAll}`;
  const seed = origIndex;

  if (viewMode === 'bullets') {
    const segs = segmentSentences(beat.narrative);
    return (
      <div className="lines bullets">
        <ul className="bulletlist">
          {segs.map((seg, si) => (
            <li key={si}>
              <MaskedText
                text={seg}
                seed={seed * 1000 + si}
                level={level}
                makeParas={false}
                revealAll={revealAll}
                resetKey={resetKey + '|' + si}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (viewMode === 'cards') {
    return (
      <Flashcard
        beat={beat}
        seed={seed}
        level={level}
        revealAll={revealAll}
        resetKey={resetKey}
      />
    );
  }

  return (
    <div className="lines">
      <MaskedText
        text={beat.narrative}
        seed={seed}
        level={level}
        makeParas
        revealAll={revealAll}
        resetKey={resetKey}
      />
    </div>
  );
}
