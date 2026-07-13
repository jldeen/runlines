import type { Deck, Recent, SavedState, ScoreMap, ScoreVal, TpPrefs, ViewMode } from '../types';

export const KEYS = {
  recents: 'runlines.recents',
  state: 'runlines.state',
  scores: 'runlines.scores',
  view: 'runlines.view',
  tp: 'runlines.tp',
  cue: 'runlines.cue',
} as const;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const val = JSON.parse(raw);
    return val ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / disabled — ignore */
  }
}

/**
 * Stable identity for a script based on its content, so scores don't collide
 * between different scripts that happen to share a title/beat count.
 */
export function scriptKey(deck: Deck): string {
  let h = 0x811c9dc5;
  const src = deck.title + '\u0000' + deck.beats.map((b) => b.narrative).join('\u0000');
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${deck.title.slice(0, 40)}#${(h >>> 0).toString(36)}#${deck.beats.length}`;
}

/* ---------- Recents ---------- */
export function getRecents(): Recent[] {
  const r = readJSON<unknown>(KEYS.recents, []);
  if (!Array.isArray(r)) return [];
  return r.filter(
    (x): x is Recent =>
      !!x && typeof x === 'object' && typeof (x as Recent).url === 'string',
  );
}

export function saveRecent(title: string, url: string): void {
  let r = getRecents().filter((x) => x.url !== url);
  r.unshift({ title, url, at: Date.now() });
  r = r.slice(0, 6);
  writeJSON(KEYS.recents, r);
}

/* ---------- Saved position ---------- */
export function getSavedState(): SavedState | null {
  const s = readJSON<Partial<SavedState> | null>(KEYS.state, null);
  if (s && typeof s.key === 'string' && typeof s.idx === 'number' && typeof s.level === 'number') {
    return s as SavedState;
  }
  return null;
}

export function saveState(s: SavedState): void {
  writeJSON(KEYS.state, s);
}

/* ---------- Scores ---------- */
export function getAllScores(): ScoreMap {
  const s = readJSON<ScoreMap>(KEYS.scores, {});
  return s && typeof s === 'object' ? s : {};
}

export function saveAllScores(s: ScoreMap): void {
  writeJSON(KEYS.scores, s);
}

export function getDeckScores(deck: Deck): Record<string, ScoreVal> {
  return getAllScores()[scriptKey(deck)] || {};
}

/* ---------- View + teleprompter prefs ---------- */
export function getSavedView(): ViewMode {
  const v = readJSON<string>(KEYS.view, 'lines');
  return v === 'bullets' || v === 'cards' || v === 'lines' ? v : 'lines';
}

export function saveView(v: ViewMode): void {
  writeJSON(KEYS.view, v);
}

const TP_DEFAULTS: TpPrefs = { speed: 1.2, size: 44, style: 'lines', mirror: false };

export function getTpPrefs(): TpPrefs {
  const p = readJSON<Partial<TpPrefs>>(KEYS.tp, {});
  return {
    speed: typeof p.speed === 'number' ? p.speed : TP_DEFAULTS.speed,
    size: typeof p.size === 'number' ? p.size : TP_DEFAULTS.size,
    style: p.style === 'bullets' || p.style === 'lines' ? p.style : TP_DEFAULTS.style,
    mirror: !!p.mirror,
  };
}

export function saveTpPrefs(p: TpPrefs): void {
  writeJSON(KEYS.tp, p);
}

/* ---------- Stage-cue collapse (collapsed by default) ---------- */
export function getCueExpanded(): boolean {
  return readJSON<boolean>(KEYS.cue, false) === true;
}

export function saveCueExpanded(v: boolean): void {
  writeJSON(KEYS.cue, v);
}
