import { useState } from 'react';
import type { Beat } from '../types';
import { getCueExpanded, saveCueExpanded } from '../lib/storage';

export function Cue({ beat, len, idx }: { beat: Beat; len: number; idx: number }) {
  return (
    <>
      <div className="meta">
        <span className="chip" id="beatCount">
          Beat {idx + 1} / {len}
        </span>
        {beat.time ? <span className="chip time">⏱ {beat.time}</span> : null}
      </div>
      <div
        className="progressbar"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={len}
        aria-valuenow={idx + 1}
        aria-label={`Beat ${idx + 1} of ${len}`}
      >
        <i style={{ width: (len ? ((idx + 1) / len) * 100 : 0) + '%' }} />
      </div>
    </>
  );
}

export function StageCue({ beat }: { beat: Beat }) {
  const [expanded, setExpanded] = useState<boolean>(() => getCueExpanded());

  const toggle = () => {
    setExpanded((e) => {
      const next = !e;
      saveCueExpanded(next);
      return next;
    });
  };

  return (
    <div className={'cue' + (expanded ? ' open' : ' collapsed')}>
      <button
        type="button"
        className="cue-head"
        aria-expanded={expanded}
        aria-controls="cueBody"
        onClick={toggle}
      >
        <h3>Stage cue</h3>
        <span className="cue-toggle" aria-hidden="true">
          {expanded ? '▾ Hide' : '▸ Show'}
        </span>
      </button>
      {expanded && (
        <div id="cueBody" className="cue-body">
          {beat.cue ? (
            <p>{beat.cue}</p>
          ) : (
            <p className="none">No stage direction for this beat — go by memory.</p>
          )}
        </div>
      )}
    </div>
  );
}
