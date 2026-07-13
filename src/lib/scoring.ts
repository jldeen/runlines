import type { ScoreVal } from '../types';

export interface ScoreCounts {
  got: number;
  shaky: number;
  missed: number;
  unrated: number;
}

export const SCORE_META: Record<ScoreVal, string> = {
  got: '✅ Got it',
  shaky: '🟡 Shaky',
  missed: '❌ Missed',
};

export function countScores(
  scores: Record<string, ScoreVal>,
  beatCount: number,
): ScoreCounts {
  const c: ScoreCounts = { got: 0, shaky: 0, missed: 0, unrated: 0 };
  for (let i = 0; i < beatCount; i++) {
    const v = scores[String(i)];
    if (v === 'got' || v === 'shaky' || v === 'missed') c[v]++;
    else c.unrated++;
  }
  return c;
}

// Beats needing work, worst-first: missed, then shaky, then unrated.
export function weakOrder(
  scores: Record<string, ScoreVal>,
  beatCount: number,
): number[] {
  const missed: number[] = [];
  const shaky: number[] = [];
  const unrated: number[] = [];
  for (let i = 0; i < beatCount; i++) {
    const v = scores[String(i)];
    if (v === 'missed') missed.push(i);
    else if (v === 'shaky') shaky.push(i);
    else if (!v) unrated.push(i);
  }
  return [...missed, ...shaky, ...unrated];
}
