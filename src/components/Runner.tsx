import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, activeLen, currentBeatIndex } from '../state/store';
import { LEVELS } from '../lib/mask';
import { useKeyboard } from '../hooks/useKeyboard';
import type { Beat, BeatEdit, ScoreVal, ViewMode } from '../types';
import { Cue, StageCue } from './Cue';
import { PaceTimer } from './PaceTimer';
import { BeatView } from './BeatView';
import { Controls } from './Controls';
import { SummaryDialog } from './SummaryDialog';
import { ExportDialog } from './ExportDialog';
import { Teleprompter } from './Teleprompter';
import { DrillDialog } from './DrillDialog';
import { EditDialog } from './EditDialog';
import { VoiceCheck } from './VoiceCheck';

function applyEdit(beat: Beat, edit: BeatEdit | undefined): Beat {
  if (!edit) return beat;
  return {
    ...beat,
    narrative: edit.narrative != null && edit.narrative !== '' ? edit.narrative : beat.narrative,
    cue: edit.cue != null ? edit.cue : beat.cue,
  };
}

export function Runner() {
  const { state, dispatch } = useStore();
  const deck = state.deck!;
  const len = activeLen(state);
  const origIdx = currentBeatIndex(state);
  const edited = !!state.edits[String(origIdx)];
  const beat = useMemo(
    () => applyEdit(deck.beats[origIdx], state.edits[String(origIdx)]),
    [deck.beats, origIdx, state.edits],
  );

  const [flashToken, setFlashToken] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [tpOpen, setTpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [hintSteps, setHintSteps] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const anyDialogOpen = summaryOpen || tpOpen || exportOpen || drillOpen || editOpen;

  // Hint reveals more of THIS beat only; reset on navigation.
  const effectiveLevel = Math.max(0, state.level - hintSteps);
  useEffect(() => {
    setHintSteps(0);
  }, [state.idx, state.order]);

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
  const setScoreDirect = (v: ScoreVal) => {
    dispatch({ type: 'SET_SCORE', beatIndex: origIdx, val: v });
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

  // Beats in the active practice order (for the hands-free drill).
  const orderedBeats: Beat[] = (state.order ?? deck.beats.map((_, i) => i)).map((i) =>
    applyEdit(deck.beats[i], state.edits[String(i)]),
  );

  const canHint = effectiveLevel > 0;

  return (
    <>
      <section id="runner">
        {(state.reviewMode || state.dueMode) && (
          <div className="banner">
            <span>
              <strong>{state.dueMode ? 'Practice due' : 'Review mode'}</strong> ·{' '}
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
        <div className="meta pacerow">
          <PaceTimer target={beat.time} resetKey={`${origIdx}|${state.order ? 'o' : 'n'}`} />
        </div>

        <div className="stage" ref={stageRef}>
          <StageCue beat={beat} />
          <div className="card">
            <BeatView
              beat={beat}
              origIndex={origIdx}
              viewMode={state.viewMode}
              level={LEVELS[effectiveLevel]}
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
                <VoiceCheck target={beat.narrative} onScore={setScoreDirect} />
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
          shuffled={!!state.order && !state.reviewMode && !state.dueMode}
          onStartOver={() => dispatch({ type: 'START_OVER' })}
          onCover={() => dispatch({ type: 'SET_COVER', on: true })}
          onRevealAll={reveal}
          onShuffle={() => dispatch({ type: 'TOGGLE_SHUFFLE' })}
          onSpeak={speak}
          onTeleprompter={() => setTpOpen(true)}
          onSummary={() => setSummaryOpen(true)}
          onExport={() => setExportOpen(true)}
          onHint={() => setHintSteps((h) => h + 1)}
          hintLabel={canHint ? '💡 Hint' : '💡 Shown'}
          hintActive={hintSteps > 0}
          onDrill={() => setDrillOpen(true)}
          onEdit={() => setEditOpen(true)}
          edited={edited}
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
        srs={state.srs}
        onClose={() => setSummaryOpen(false)}
        onJump={(i) => {
          dispatch({ type: 'JUMP_TO_ORIGINAL', origIdx: i });
          setSummaryOpen(false);
        }}
        onReview={(order) => {
          dispatch({ type: 'START_REVIEW', order });
          setSummaryOpen(false);
        }}
        onDue={(order) => {
          dispatch({ type: 'START_DUE', order });
          setSummaryOpen(false);
        }}
        onReset={() => dispatch({ type: 'RESET_SCORES' })}
      />

      <ExportDialog open={exportOpen} deck={deck} onClose={() => setExportOpen(false)} />

      <DrillDialog open={drillOpen} beats={orderedBeats} onClose={() => setDrillOpen(false)} />

      <EditDialog
        open={editOpen}
        beat={beat}
        beatIndex={origIdx}
        edited={edited}
        onClose={() => setEditOpen(false)}
        onSave={(edit) => dispatch({ type: 'EDIT_BEAT', beatIndex: origIdx, edit })}
      />

      <Teleprompter
        open={tpOpen}
        deck={deck}
        viewMode={state.viewMode}
        onClose={() => setTpOpen(false)}
      />
    </>
  );
}
