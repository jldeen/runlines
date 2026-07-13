import type { Beat } from '../types';

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
  return (
    <div className="cue">
      <h3>Stage cue</h3>
      {beat.cue ? (
        <p>{beat.cue}</p>
      ) : (
        <p className="none">No stage direction for this beat — go by memory.</p>
      )}
    </div>
  );
}
