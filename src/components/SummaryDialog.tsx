import { useRef, useState } from 'react';
import type { Deck, ScoreVal, SrsCard } from '../types';
import { countScores, SCORE_META, weakOrder } from '../lib/scoring';
import { dueOrder } from '../lib/srs';
import { addHistoryRecord, getDeckHistory } from '../lib/storage';
import { downloadProgress, importProgress } from '../lib/progress';
import { Dialog } from './Dialog';

interface SummaryDialogProps {
  open: boolean;
  deck: Deck;
  scores: Record<string, ScoreVal>;
  srs: Record<string, SrsCard>;
  onClose: () => void;
  onJump: (origIdx: number) => void;
  onReview: (order: number[]) => void;
  onDue: (order: number[]) => void;
  onReset: () => void;
}

export function SummaryDialog({
  open,
  deck,
  scores,
  srs,
  onClose,
  onJump,
  onReview,
  onDue,
  onReset,
}: SummaryDialogProps) {
  const total = deck.beats.length;
  const c = countScores(scores, total);
  const rated = c.got + c.shaky + c.missed;
  const weak = weakOrder(scores, total);
  const due = dueOrder(srs, total);
  const fileRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState(() => getDeckHistory(deck));
  const [note, setNote] = useState('');

  const sub = rated
    ? `${rated} of ${total} beats rated · ${c.got} solid, ${c.shaky + c.missed} to work on`
    : 'No beats rated yet — cover a beat, deliver it, then score your recall.';

  const saveSnapshot = () => {
    const list = addHistoryRecord(deck, {
      at: Date.now(),
      got: c.got,
      shaky: c.shaky,
      missed: c.missed,
      unrated: c.unrated,
      total,
    });
    setHistory(list);
    setNote('Saved this run to history.');
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const n = importProgress(text);
      setNote(`Imported progress for ${n} script${n === 1 ? '' : 's'}. Reload a script to see it.`);
    } catch (e) {
      setNote('Import failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="summaryTitle">
      <h2 id="summaryTitle">Session summary</h2>
      <p className="sub">{sub}</p>
      <div className="statgrid">
        <div className="stat got">
          <div className="num">{c.got}</div>
          <div className="lbl">Got it</div>
        </div>
        <div className="stat shaky">
          <div className="num">{c.shaky}</div>
          <div className="lbl">Shaky</div>
        </div>
        <div className="stat missed">
          <div className="num">{c.missed}</div>
          <div className="lbl">Missed</div>
        </div>
        <div className="stat unrated">
          <div className="num">{c.unrated}</div>
          <div className="lbl">Unrated</div>
        </div>
      </div>
      <label>Per-beat</label>
      <div className="strip">
        {deck.beats.map((_, i) => {
          const v = scores[String(i)] || '';
          return (
            <button
              key={i}
              type="button"
              className={'pip' + (v ? ' ' + v : '')}
              title={`Beat ${i + 1}${v ? ' — ' + SCORE_META[v as ScoreVal] : ' — unrated'}`}
              aria-label={`Beat ${i + 1}${v ? ', ' + SCORE_META[v as ScoreVal] : ', unrated'}`}
              onClick={() => onJump(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="row2">
        <button
          type="button"
          className="btn"
          disabled={weak.length === 0}
          onClick={() => onReview(weak)}
        >
          {weak.length ? `🎯 Review weak beats (${weak.length})` : '🎉 Nothing to review'}
        </button>
      </div>
      <div className="row2" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn"
          disabled={due.order.length === 0}
          onClick={() => onDue(due.order)}
        >
          {due.order.length
            ? `⏱ Practice due (${due.dueCount} due${due.newCount ? ` + ${due.newCount} new` : ''})`
            : '⏱ Nothing due right now'}
        </button>
      </div>

      {history.length > 0 && (
        <>
          <label style={{ marginTop: 14 }}>Session history</label>
          <div className="history">
            {history.slice(0, 6).map((h, i) => {
              const pct = h.total ? Math.round((h.got / h.total) * 100) : 0;
              const d = new Date(h.at);
              return (
                <div className="histrow" key={i}>
                  <span className="histdate">
                    {d.toLocaleDateString()}{' '}
                    {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="histbar">
                    <i style={{ width: pct + '%' }} />
                  </span>
                  <span className="histpct">{pct}% got</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {note ? (
        <div className="sub" style={{ marginTop: 10 }}>
          {note}
        </div>
      ) : null}

      <div className="row2" style={{ marginTop: 14 }}>
        <button type="button" className="btn secondary" onClick={saveSnapshot}>
          💾 Save run to history
        </button>
        <button type="button" className="btn secondary" onClick={downloadProgress}>
          ⬇ Export progress
        </button>
      </div>
      <div className="row2" style={{ marginTop: 10 }}>
        <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()}>
          ⬆ Import progress
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            if (window.confirm('Clear all recall scores for this script?')) onReset();
          }}
        >
          Reset scores
        </button>
      </div>
      <div className="row2" style={{ marginTop: 10 }}>
        <button type="button" className="btn secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
