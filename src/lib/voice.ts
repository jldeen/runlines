import type { ScoreVal } from '../types';

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export interface AccuracyResult {
  accuracy: number; // 0..1 fraction of target words spoken
  matched: number;
  total: number;
  suggestion: ScoreVal;
}

/**
 * Compare spoken text against the target narrative using a bag-of-words overlap.
 * Order-insensitive and forgiving of filler, which suits line delivery where a
 * word or two may be paraphrased.
 */
export function scoreDelivery(target: string, spoken: string): AccuracyResult {
  const want = normalizeWords(target);
  const got = normalizeWords(spoken);
  const total = want.length;
  if (total === 0) return { accuracy: 1, matched: 0, total: 0, suggestion: 'got' };

  const pool = new Map<string, number>();
  for (const w of got) pool.set(w, (pool.get(w) ?? 0) + 1);

  let matched = 0;
  for (const w of want) {
    const n = pool.get(w) ?? 0;
    if (n > 0) {
      matched++;
      pool.set(w, n - 1);
    }
  }
  const accuracy = matched / total;
  const suggestion: ScoreVal = accuracy >= 0.85 ? 'got' : accuracy >= 0.55 ? 'shaky' : 'missed';
  return { accuracy, matched, total, suggestion };
}
