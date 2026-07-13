import { useState } from 'react';
import type { Deck } from '../types';
import type { ExportOpts } from '../lib/pptx';
import { Dialog } from './Dialog';

interface ExportDialogProps {
  open: boolean;
  deck: Deck;
  onClose: () => void;
}

const DEFAULTS: Omit<ExportOpts, 'title'> = {
  mode: 'bullets',
  maxPerCard: 5,
  fontSize: 28,
  includeCue: true,
};

export function ExportDialog({ open, deck, onClose }: ExportDialogProps) {
  const [opts, setOpts] = useState<ExportOpts>({ ...DEFAULTS, title: deck.title });
  const [format, setFormat] = useState<'pptx' | 'pdf'>('pptx');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof ExportOpts>(k: K, v: ExportOpts[K]) =>
    setOpts((o) => ({ ...o, [k]: v }));

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      // Load the heavy export libs lazily so they stay out of the main bundle.
      if (format === 'pdf') {
        const { exportNoteCardsPdf } = await import('../lib/pdf');
        await exportNoteCardsPdf(deck.beats, opts);
      } else {
        const { exportNoteCards } = await import('../lib/pptx');
        await exportNoteCards(deck.beats, opts);
      }
      onClose();
    } catch (e) {
      setError('Export failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="exportTitle">
      <h2 id="exportTitle">Export note cards</h2>
      <p className="sub">White text on black — one beat per card, split when it won&apos;t fit.</p>

      <div className="field">
        <label>Format</label>
        <div className="modebar" role="group" aria-label="File format">
          <button
            type="button"
            className={'modebtn' + (format === 'pptx' ? ' sel' : '')}
            aria-pressed={format === 'pptx'}
            onClick={() => setFormat('pptx')}
          >
            📊 PowerPoint
          </button>
          <button
            type="button"
            className={'modebtn' + (format === 'pdf' ? ' sel' : '')}
            aria-pressed={format === 'pdf'}
            onClick={() => setFormat('pdf')}
          >
            📄 PDF
          </button>
        </div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Content</label>
        <div className="modebar" role="group" aria-label="Card content">
          <button
            type="button"
            className={'modebtn' + (opts.mode === 'bullets' ? ' sel' : '')}
            aria-pressed={opts.mode === 'bullets'}
            onClick={() => set('mode', 'bullets')}
          >
            • Bullets
          </button>
          <button
            type="button"
            className={'modebtn' + (opts.mode === 'lines' ? ' sel' : '')}
            aria-pressed={opts.mode === 'lines'}
            onClick={() => set('mode', 'lines')}
          >
            📄 Full lines
          </button>
        </div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="expPer">
          Max {opts.mode === 'bullets' ? 'bullets' : 'lines'} per card: {opts.maxPerCard}
        </label>
        <input
          type="range"
          id="expPer"
          min={2}
          max={10}
          step={1}
          value={opts.maxPerCard}
          onChange={(e) => set('maxPerCard', +e.target.value)}
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="expSize">Font size: {opts.fontSize}pt</label>
        <input
          type="range"
          id="expSize"
          min={16}
          max={44}
          step={2}
          value={opts.fontSize}
          onChange={(e) => set('fontSize', +e.target.value)}
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="expTitle">File title</label>
        <input
          type="text"
          id="expTitle"
          value={opts.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </div>

      <label className="checkline" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={opts.includeCue}
          onChange={(e) => set('includeCue', e.target.checked)}
        />
        Include stage cue on each card
      </label>

      {error ? <div className="err" style={{ display: 'block' }}>{error}</div> : null}

      <div className="row2" style={{ marginTop: 16 }}>
        <button type="button" className="btn" disabled={busy} onClick={run}>
          {busy ? 'Building…' : `⬇ Export ${deck.beats.length} beats`}
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
