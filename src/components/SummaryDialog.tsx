import type { Deck, ScoreVal } from '../types';
import { countScores, SCORE_META, weakOrder } from '../lib/scoring';
import { Dialog } from './Dialog';

interface SummaryDialogProps {
  open: boolean;
  deck: Deck;
  scores: Record<string, ScoreVal>;
  onClose: () => void;
  onJump: (origIdx: number) => void;
  onReview: (order: number[]) => void;
  onReset: () => void;
}

export function SummaryDialog({
  open,
  deck,
  scores,
  onClose,
  onJump,
  onReview,
  onReset,
}: SummaryDialogProps) {
  const total = deck.beats.length;
  const c = countScores(scores, total);
  const rated = c.got + c.shaky + c.missed;
  const weak = weakOrder(scores, total);

  const sub = rated
    ? `${rated} of ${total} beats rated · ${c.got} solid, ${c.shaky + c.missed} to work on`
    : 'No beats rated yet — cover a beat, deliver it, then score your recall.';

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
          className="btn secondary"
          onClick={() => {
            if (window.confirm('Clear all recall scores for this script?')) onReset();
          }}
        >
          Reset scores
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
