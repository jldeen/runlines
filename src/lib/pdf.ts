import { jsPDF } from 'jspdf';
import type { Beat } from '../types';
import { segmentSentences } from './segment';
import type { ExportOpts } from './pptx';

function chunk<T>(arr: T[], n: number): T[][] {
  if (n < 1) n = 1;
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function itemsFor(b: Beat, mode: ExportOpts['mode']): string[] {
  if (mode === 'bullets') return segmentSentences(b.narrative);
  const lines = b.narrative
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length ? lines : [b.narrative.trim()];
}

function safeName(title: string): string {
  const base = (title || 'runlines-notecards').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return (base || 'runlines-notecards') + '.pdf';
}

/**
 * Build a note-card PDF: white text on black, landscape, one beat (or a chunk of
 * a long beat) per page — a print-friendly mirror of the PPTX export.
 */
export async function exportNoteCardsPdf(beats: Beat[], opts: ExportOpts): Promise<void> {
  // Landscape, points, matching the 16:9 card proportion (720x405pt).
  const W = 720;
  const H = 405;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [W, H] });
  doc.setProperties({ title: opts.title, author: 'RunLines' });

  const cueSize = Math.max(10, Math.round(opts.fontSize * 0.5));
  const marginX = 44;
  const bodyW = W - marginX * 2;
  let first = true;

  beats.forEach((b, bi) => {
    const items = itemsFor(b, opts.mode);
    const groups = chunk(items, opts.maxPerCard);
    groups.forEach((grp, gi) => {
      if (!first) doc.addPage([W, H], 'landscape');
      first = false;

      // Black background.
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, W, H, 'F');

      let y = 60;
      if (opts.includeCue && b.cue) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cueSize);
        doc.setTextColor(240, 180, 41); // amber accent
        const cueLines = doc.splitTextToSize(b.cue.toUpperCase(), bodyW);
        doc.text(cueLines, marginX, y);
        y += cueLines.length * (cueSize * 1.2) + 18;
      }

      // Body: vertically centered block.
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(opts.fontSize);
      doc.setTextColor(255, 255, 255);
      const lh = opts.fontSize * 1.3;

      const wrapped: string[] = [];
      for (const item of grp) {
        const prefix = opts.mode === 'bullets' ? '\u2022  ' : '';
        const lines = doc.splitTextToSize(prefix + item, bodyW) as string[];
        wrapped.push(...lines);
      }
      const blockH = wrapped.length * lh;
      const startY = Math.max(y, (H - blockH) / 2 + lh * 0.75);
      wrapped.forEach((line, i) => {
        doc.text(line, marginX, startY + i * lh);
      });

      // Card number.
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(139, 149, 163);
      const label = groups.length > 1 ? `${bi + 1} \u00b7 ${gi + 1}/${groups.length}` : `${bi + 1}`;
      doc.text(label, W - marginX, H - 22, { align: 'right' });
    });
  });

  doc.save(safeName(opts.title));
}
