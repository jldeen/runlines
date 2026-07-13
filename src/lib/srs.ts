import type { ScoreVal, SrsCard } from '../types';

/**
 * Leitner-style spaced repetition tuned for fast (hours-long) memorization.
 * Boxes 0..5 map to short intervals in minutes so a beat can cycle several
 * times in a single practice session.
 */
export const BOX_INTERVALS_MIN = [1, 3, 8, 20, 45, 120] as const;
export const MAX_BOX = BOX_INTERVALS_MIN.length - 1;

const MIN = 60 * 1000;

export function intervalMs(box: number): number {
  const b = Math.max(0, Math.min(MAX_BOX, box));
  return BOX_INTERVALS_MIN[b] * MIN;
}

/** Apply a recall score to a card, returning the next schedule. */
export function applyScore(prev: SrsCard | undefined, val: ScoreVal, now = Date.now()): SrsCard {
  const box = prev ? prev.box : 0;
  let next: number;
  if (val === 'got') next = Math.min(MAX_BOX, box + 1);
  else if (val === 'shaky') next = box; // stays in the same box, sooner review
  else next = 0; // missed → back to the start
  const interval = val === 'shaky' ? Math.max(MIN, intervalMs(next) / 2) : intervalMs(next);
  return { box: next, due: now + interval, last: now };
}

export interface DueInfo {
  /** original beat indices that are due now (or never scheduled), soonest first */
  order: number[];
  dueCount: number;
  newCount: number;
}

/**
 * Compute a "practice due" order across all beats. Beats with a due time in the
 * past come first (soonest-due first); beats never scheduled are treated as new
 * and appended after due ones.
 */
export function dueOrder(
  srs: Record<string, SrsCard>,
  beatCount: number,
  now = Date.now(),
): DueInfo {
  const due: { i: number; due: number }[] = [];
  const fresh: number[] = [];
  for (let i = 0; i < beatCount; i++) {
    const c = srs[String(i)];
    if (!c) {
      fresh.push(i);
    } else if (c.due <= now) {
      due.push({ i, due: c.due });
    }
  }
  due.sort((a, b) => a.due - b.due);
  return {
    order: [...due.map((d) => d.i), ...fresh],
    dueCount: due.length,
    newCount: fresh.length,
  };
}

/** How many beats are due right now (excludes never-scheduled beats). */
export function dueCount(srs: Record<string, SrsCard>, now = Date.now()): number {
  let n = 0;
  for (const k of Object.keys(srs)) {
    if (srs[k] && srs[k].due <= now) n++;
  }
  return n;
}

/** Human label for when a beat is next due. */
export function dueLabel(card: SrsCard | undefined, now = Date.now()): string {
  if (!card) return 'new';
  const diff = card.due - now;
  if (diff <= 0) return 'due now';
  const mins = Math.round(diff / MIN);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  return `in ${hrs}h`;
}
