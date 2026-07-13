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

// Body box geometry (inches) — must match the addText call below.
const BODY_W = 8.8;
const BODY_H = 3.95;

/** Estimate how many wrapped lines a string takes at a given font size. */
function estimateLines(text: string, fontSize: number): number {
  // Average glyph advance ~0.5em; subtract the bullet indent from usable width.
  const charW = (fontSize * 0.5) / 72;
  const usableW = BODY_W - 0.3;
  const charsPerLine = Math.max(8, Math.floor(usableW / charW));
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1;
  let col = 0;
  for (const w of words) {
    // A word longer than a line wraps onto multiple lines by itself.
    if (w.length > charsPerLine) {
      if (col > 0) lines++;
      const extra = Math.ceil(w.length / charsPerLine);
      lines += extra - 1;
      col = w.length % charsPerLine || charsPerLine;
      continue;
    }
    const add = (col === 0 ? 0 : 1) + w.length;
    if (col + add > charsPerLine && col > 0) {
      lines++;
      col = w.length;
    } else {
      col += add;
    }
  }
  return lines;
}

/**
 * Break items into cards that always fit: never exceed `maxPerCard`, never
 * exceed the vertical line budget. Splits *before* adding an item that would
 * overflow, so a card is only ever over-budget when a single item is itself
 * larger than the budget (unavoidable — it gets its own card).
 */
function fillCards(items: string[], est: number[], maxPerCard: number, maxLines: number): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let curLines = 0;
  for (let i = 0; i < items.length; i++) {
    const wouldOverflow =
      cur.length > 0 && (cur.length + 1 > maxPerCard || curLines + est[i] > maxLines);
    if (wouldOverflow) {
      out.push(cur);
      cur = [];
      curLines = 0;
    }
    cur.push(items[i]);
    curLines += est[i];
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Group bullets into cards that actually fit and are balanced. First compute
 * the minimum number of valid cards, then redistribute items evenly across that
 * many cards so no card is crammed while another is nearly empty (avoids the
 * "5 bullets then 1 orphan" look). Falls back to the strict fill if a balanced
 * layout would violate a budget.
 */
function packItems(items: string[], maxPerCard: number, fontSize: number): string[][] {
  if (items.length === 0) return [[]];
  if (maxPerCard < 1) maxPerCard = 1;
  const lineH = (fontSize * 1.38) / 72; // font size * line-spacing, in inches
  const maxLines = Math.max(2, Math.floor(BODY_H / lineH));
  const est = items.map((t) => estimateLines(t, fontSize));

  // Correctness-first base layout — guaranteed within budgets.
  const base = fillCards(items, est, maxPerCard, maxLines);
  const N = base.length;
  if (N <= 1) return base;

  // Balancing pass across exactly N cards, respecting both budgets.
  const total = est.reduce((a, b) => a + b, 0);
  const target = total / N;
  const balanced: string[][] = [];
  let cur: string[] = [];
  let curLines = 0;
  let cardsLeft = N;
  for (let i = 0; i < items.length; i++) {
    if (cur.length > 0) {
      const itemsLeft = items.length - i; // includes current
      const overflow = cur.length + 1 > maxPerCard || curLines + est[i] > maxLines;
      const reserve = itemsLeft <= cardsLeft - 1; // keep >=1 item per remaining card
      const enough = curLines >= target;
      if (cardsLeft > 1 && (overflow || reserve || enough)) {
        balanced.push(cur);
        cur = [];
        curLines = 0;
        cardsLeft--;
      }
    }
    cur.push(items[i]);
    curLines += est[i];
  }
  if (cur.length) balanced.push(cur);

  // Only use the balanced layout if it's valid and preserves the card count.
  const valid =
    balanced.length === N &&
    balanced.every(
      (c) => c.length <= maxPerCard && c.reduce((a, t) => a + estimateLines(t, fontSize), 0) <= maxLines,
    );
  return valid ? balanced : base;
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

  beats.forEach((b, bi) => {
    const items = itemsFor(b, opts.mode);
    const groups = packItems(items, opts.maxPerCard, opts.fontSize);
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
          fit: 'shrink',
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
        w: BODY_W,
        h: BODY_H,
        fontSize: opts.fontSize,
        color: 'FFFFFF',
        align: 'left',
        valign: 'top',
        lineSpacingMultiple: 1.15,
        fit: 'shrink',
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
