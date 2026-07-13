import { useEffect, useRef, useState } from 'react';
import { useStore, activeLen, currentBeatIndex } from '../state/store';
import { LEVELS } from '../lib/mask';
import { useKeyboard } from '../hooks/useKeyboard';
import type { ScoreVal, ViewMode } from '../types';
import { Cue, StageCue } from './Cue';
import { BeatView } from './BeatView';
import { Controls } from './Controls';
import { SummaryDialog } from './SummaryDialog';
import { ExportDialog } from './ExportDialog';
import { Teleprompter } from './Teleprompter';

export function Runner() {
  const { state, dispatch } = useStore();
  const deck = state.deck!;
  const len = activeLen(state);
  const origIdx = currentBeatIndex(state);
  const beat = deck.beats[origIdx];

  const [flashToken, setFlashToken] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [tpOpen, setTpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const anyDialogOpen = summaryOpen || tpOpen || exportOpen;

  // Scroll to the top of the beat on navigation.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) stage.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.idx, state.order]);

  const flash = () => setFlashToken((t) => t + 1);
  const reveal = () => {
    const wasCovered = state.covered;
    dispatch({ type: 'REVEAL_ALL' });
    if (wasCovered) flash();
  };
  const revealCurtain = () => {
    dispatch({ type: 'SET_COVER', on: false });
    flash();
  };

  const scoreValue: ScoreVal | null = (state.scores[String(origIdx)] as ScoreVal) ?? null;
  const onScore = (v: ScoreVal) => {
    dispatch({ type: 'SET_SCORE', beatIndex: origIdx, val: scoreValue === v ? null : v });
  };

  const speak = () => {
    const txt = beat.cue || 'No cue. Your line.';
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.rate = 1;
      speechSynthesis.speak(u);
    } catch {
      /* speech not available */
    }
  };

  useKeyboard(
    {
      onLeft: () => dispatch({ type: 'GO', delta: -1 }),
      onRight: () => dispatch({ type: 'GO', delta: 1 }),
      onSpace: () => dispatch({ type: 'SET_COVER', on: !state.covered }),
    },
    !anyDialogOpen,
  );

  return (
    <>
      <section id="runner">
        {state.reviewMode && (
          <div className="banner">
            <span>
              <strong>Review mode</strong> ·{' '}
              <span>
                {len} beat{len > 1 ? 's' : ''} to work on
              </span>
            </span>
            <button
              type="button"
              className="iconbtn"
              onClick={() => dispatch({ type: 'EXIT_REVIEW', silent: false })}
            >
              Exit
            </button>
          </div>
        )}

        <Cue beat={beat} len={len} idx={state.idx} />

        <div className="stage" ref={stageRef}>
          <StageCue beat={beat} />
          <div className="card">
            <BeatView
              beat={beat}
              origIndex={origIdx}
              viewMode={state.viewMode}
              level={LEVELS[state.level]}
              revealAll={state.revealAll}
            />
            {state.covered && (
              <div className="curtain">
                <p className="big">Say the line from memory</p>
                <p>Deliver this beat out loud using only the stage cue above, then reveal to check.</p>
                <button
                  type="button"
                  className="btn"
                  style={{ maxWidth: 220 }}
                  onClick={revealCurtain}
                >
                  Reveal line
                </button>
              </div>
            )}
          </div>
        </div>

        <Controls
          viewMode={state.viewMode}
          onView={(v: ViewMode) => dispatch({ type: 'SET_VIEW', view: v })}
          scoreValue={scoreValue}
          onScore={onScore}
          flashToken={flashToken}
          level={state.level}
          onLevel={(n) => dispatch({ type: 'SET_LEVEL', level: n })}
          shuffled={!!state.order && !state.reviewMode}
          onStartOver={() => dispatch({ type: 'START_OVER' })}
          onCover={() => dispatch({ type: 'SET_COVER', on: true })}
          onRevealAll={reveal}
          onShuffle={() => dispatch({ type: 'TOGGLE_SHUFFLE' })}
          onSpeak={speak}
          onTeleprompter={() => setTpOpen(true)}
          onSummary={() => setSummaryOpen(true)}
          onExport={() => setExportOpen(true)}
        />
      </section>

      <div className="navbar">
        <div className="inner">
          <button
            type="button"
            className="btn secondary"
            disabled={state.idx <= 0}
            onClick={() => dispatch({ type: 'GO', delta: -1 })}
          >
            ‹ Prev
          </button>
          <button
            type="button"
            className="btn wide"
            disabled={state.idx >= len - 1}
            onClick={() => dispatch({ type: 'GO', delta: 1 })}
          >
            Next ›
          </button>
        </div>
      </div>

      <SummaryDialog
        open={summaryOpen}
        deck={deck}
        scores={state.scores}
        onClose={() => setSummaryOpen(false)}
        onJump={(i) => {
          dispatch({ type: 'JUMP_TO_ORIGINAL', origIdx: i });
          setSummaryOpen(false);
        }}
        onReview={(order) => {
          dispatch({ type: 'START_REVIEW', order });
          setSummaryOpen(false);
        }}
        onReset={() => dispatch({ type: 'RESET_SCORES' })}
      />

      <ExportDialog open={exportOpen} deck={deck} onClose={() => setExportOpen(false)} />

      <Teleprompter
        open={tpOpen}
        deck={deck}
        viewMode={state.viewMode}
        onClose={() => setTpOpen(false)}
      />
    </>
  );
}
