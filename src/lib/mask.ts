export interface Level {
  n: string;
  frac: number;
  firstLetter: boolean;
}

export const LEVELS: Level[] = [
  { n: 'Full text', frac: 0, firstLetter: false },
  { n: 'Light fade', frac: 0.25, firstLetter: true },
  { n: 'Half gone', frac: 0.5, firstLetter: true },
  { n: 'First letters', frac: 0.8, firstLetter: true },
  { n: 'Ghost', frac: 1, firstLetter: true },
  { n: 'Blackout', frac: 1, firstLetter: false },
];

export type Token =
  | { t: 'word'; v: string }
  | { t: 'space'; v: string }
  | { t: 'break' };

// Unicode-aware "contains a letter or number" test (fixes non-Latin masking).
let LETTER_NUM: RegExp;
try {
  LETTER_NUM = /[\p{L}\p{N}]/u;
} catch {
  LETTER_NUM = /[A-Za-z0-9]/;
}
let LEAD_NON_WORD: RegExp;
try {
  LEAD_NON_WORD = /^[^\p{L}\p{N}]*/u;
} catch {
  LEAD_NON_WORD = /^[^A-Za-z0-9]*/;
}

export function isWordish(v: string): boolean {
  return LETTER_NUM.test(v);
}

export function tokenize(text: string): Token[] {
  const parts: Token[] = [];
  const re = /(\s+)|([^\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) {
      if (m[1].includes('\n')) {
        const segs = m[1].split('\n');
        for (let i = 0; i < segs.length; i++) {
          if (i > 0) parts.push({ t: 'break' });
        }
      } else {
        parts.push({ t: 'space', v: m[1] });
      }
    } else {
      parts.push({ t: 'word', v: m[2] });
    }
  }
  return parts;
}

// Deterministic pseudo-random per beat so masking is stable while fading.
export function seeded(i: number, seed: number): number {
  const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Hint text shown for a masked word (first letter + dots, or plain dots). */
export function hintFor(word: string, firstLetter: boolean): string {
  if (!firstLetter) return '···';
  const lead = (word.match(LEAD_NON_WORD) || [''])[0];
  const core = word.slice(lead.length);
  return lead + (core[0] || '') + '·'.repeat(Math.max(0, Math.min(core.length - 1, 6)));
}

/**
 * Given the words of a segment, return the set of word indices (0-based over
 * maskable words) that should be masked at `level`.
 */
export function maskedWordSet(words: string[], level: Level, seed: number): Set<number> {
  const masked = new Set<number>();
  if (level.frac <= 0) return masked;
  words.forEach((w, k) => {
    if (!isWordish(w)) return;
    if (level.frac >= 1 || seeded(k, seed) < level.frac) masked.add(k);
  });
  return masked;
}
