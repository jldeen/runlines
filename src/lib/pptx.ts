import pptxgen from 'pptxgenjs';
import type { Beat } from '../types';
import { segmentSentences } from './segment';

export interface ExportOpts {
  mode: 'bullets' | 'lines';
  maxPerCard: number; // max bullets / lines per slide
  fontSize: number; // pt
  includeCue: boolean;
  title: string;
}

export const EXPORT_DEFAULTS: ExportOpts = {
  mode: 'bullets',
  maxPerCard: 5,
  fontSize: 28,
  includeCue: true,
  title: 'RunLines note cards',
};

/**
 * Split into the fewest cards needed (ceil(len / max)) but spread items as
 * evenly as possible across them, so we never get an orphan card with a single
 * bullet next to a full one (e.g. 6 items / max 5 => 3 + 3, not 5 + 1).
 */
function balancedChunk<T>(arr: T[], max: number): T[][] {
  if (max < 1) max = 1;
  const len = arr.length;
  if (len === 0) return [[]];
  const cards = Math.ceil(len / max);
  const base = Math.floor(len / cards);
  let remainder = len % cards;
  const out: T[][] = [];
  let i = 0;
  for (let c = 0; c < cards; c++) {
    const size = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    out.push(arr.slice(i, i + size));
    i += size;
  }
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
  return (base || 'runlines-notecards') + '.pptx';
}

/**
 * Build a note-card deck: white text on black, one beat (or a chunk of a long
 * beat) per slide, sized so bullets fit the card.
 */
export async function exportNoteCards(beats: Beat[], opts: ExportOpts): Promise<void> {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'CARD', width: 10, height: 5.625 });
  pptx.layout = 'CARD';
  pptx.author = 'RunLines';
  pptx.title = opts.title;

  const cueSize = Math.max(12, Math.round(opts.fontSize * 0.45));

  // Reserve the top-right corner (clock zone) and keep every card's body
  // starting at the same Y so cards look consistent regardless of bullet count.
  const CUE_W = 6.7; // cue stays left of the clock zone (slide is 10 wide)
  const BODY_Y = 1.15;
  const BODY_H = 3.95;

  beats.forEach((b, bi) => {
    const items = itemsFor(b, opts.mode);
    const groups = balancedChunk(items, opts.maxPerCard);
    groups.forEach((grp, gi) => {
      const slide = pptx.addSlide();
      slide.background = { color: '000000' };

      if (opts.includeCue && b.cue) {
        slide.addText(b.cue.toUpperCase(), {
          x: 0.55,
          y: 0.32,
          w: CUE_W,
          h: 0.6,
          fontSize: cueSize,
          color: 'F0B429',
          bold: true,
          align: 'left',
          valign: 'top',
        });
      }

      const runs = grp.map((t) => ({
        text: t,
        options: {
          bullet: opts.mode === 'bullets' ? { code: '2022', indent: 18 } : (false as const),
          breakLine: true,
        },
      }));

      slide.addText(runs, {
        x: 0.6,
        y: BODY_Y,
        w: 8.8,
        h: BODY_H,
        fontSize: opts.fontSize,
        color: 'FFFFFF',
        align: 'left',
        valign: 'top',
        lineSpacingMultiple: 1.15,
      });

      const label = groups.length > 1 ? `${bi + 1} · ${gi + 1}/${groups.length}` : `${bi + 1}`;
      slide.addText(label, {
        x: 8.4,
        y: 5.2,
        w: 1.4,
        h: 0.32,
        fontSize: 10,
        color: '8B95A3',
        align: 'right',
        valign: 'bottom',
      });
    });
  });

  await pptx.writeFile({ fileName: safeName(opts.title) });
}
