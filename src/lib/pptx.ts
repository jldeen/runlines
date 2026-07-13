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

  beats.forEach((b, bi) => {
    const items = itemsFor(b, opts.mode);
    const groups = chunk(items, opts.maxPerCard);
    groups.forEach((grp, gi) => {
      const slide = pptx.addSlide();
      slide.background = { color: '000000' };

      let bodyY = 0.5;
      let bodyH = 4.6;
      if (opts.includeCue && b.cue) {
        slide.addText(b.cue.toUpperCase(), {
          x: 0.55,
          y: 0.28,
          w: 8.9,
          h: 0.6,
          fontSize: cueSize,
          color: 'F0B429',
          bold: true,
          align: 'left',
          valign: 'top',
        });
        bodyY = 1.15;
        bodyH = 4.0;
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
        y: bodyY,
        w: 8.8,
        h: bodyH,
        fontSize: opts.fontSize,
        color: 'FFFFFF',
        align: 'left',
        valign: 'middle',
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
