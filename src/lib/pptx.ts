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

/** Estimate how many wrapped lines a bullet takes at a given font size. */
function estimateLines(text: string, fontSize: number): number {
  // Average glyph advance ~0.5em; subtract the bullet indent from usable width.
  const charW = (fontSize * 0.5) / 72;
  const usableW = BODY_W - 0.3;
  const charsPerLine = Math.max(8, Math.floor(usableW / charW));
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1;
  let col = 0;
  for (const w of words) {
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
 * Group bullets into cards that actually fit: never exceed `maxPerCard`, and
 * never exceed the vertical line budget for `fontSize`. Cards are balanced by
 * line count so no card is crammed while another is nearly empty.
 */
function packItems(items: string[], maxPerCard: number, fontSize: number): string[][] {
  if (items.length === 0) return [[]];
  const lineH = (fontSize * 1.38) / 72; // font size * line-spacing, in inches
  const maxLines = Math.max(2, Math.floor(BODY_H / lineH));
  const est = items.map((t) => Math.min(maxLines, estimateLines(t, fontSize)));
  const total = est.reduce((a, b) => a + b, 0);

  const cardsNeeded = Math.max(
    Math.ceil(items.length / Math.max(1, maxPerCard)),
    Math.ceil(total / maxLines),
    1,
  );
  const targetLines = total / cardsNeeded;

  const out: string[][] = [];
  let cur: string[] = [];
  let curLines = 0;
  let cardsLeft = cardsNeeded;

  for (let i = 0; i < items.length; i++) {
    cur.push(items[i]);
    curLines += est[i];
    const itemsLeft = items.length - 1 - i;
    const atCap = cur.length >= maxPerCard || curLines >= maxLines;
    const balanced = curLines >= targetLines;
    // Must leave at least one item for each remaining card.
    const mustClose = itemsLeft <= cardsLeft - 1;
    if (cardsLeft > 1 && (atCap || balanced || mustClose)) {
      out.push(cur);
      cur = [];
      curLines = 0;
      cardsLeft--;
    }
  }
  if (cur.length) out.push(cur);
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
