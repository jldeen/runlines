export type ScoreVal = 'got' | 'shaky' | 'missed';
export type ViewMode = 'lines' | 'bullets' | 'cards';
export type TpStyle = 'lines' | 'bullets';

export interface Beat {
  time: string;
  narrative: string;
  cue: string;
}

export interface Deck {
  title: string;
  description: string;
  beats: Beat[];
}

export interface Recent {
  title: string;
  url: string;
  at: number;
}

export interface SavedState {
  key: string;
  idx: number;
  level: number;
}

/** scores[scriptKey][beatIndex] = ScoreVal */
export type ScoreMap = Record<string, Record<string, ScoreVal>>;

export interface TpPrefs {
  speed: number;
  size: number;
  style: TpStyle;
  mirror: boolean;
}

/* ---------- Spaced repetition (Leitner) ---------- */
export interface SrsCard {
  box: number; // 0..5; higher = longer interval
  due: number; // epoch ms when next due
  last: number; // epoch ms last reviewed
}
/** srs[scriptKey][beatIndex] = SrsCard */
export type SrsMap = Record<string, Record<string, SrsCard>>;

/* ---------- Session history ---------- */
export interface RunRecord {
  at: number;
  got: number;
  shaky: number;
  missed: number;
  unrated: number;
  total: number;
}
export type HistoryMap = Record<string, RunRecord[]>;

/* ---------- Inline edits (overrides keyed by original beat index) ---------- */
export interface BeatEdit {
  narrative?: string;
  cue?: string;
}
export type EditMap = Record<string, Record<string, BeatEdit>>;

/* ---------- Offline script cache ---------- */
export interface CachedScript {
  url: string;
  title: string;
  text: string;
  at: number;
}
export type CacheMap = Record<string, CachedScript>;

/* ---------- Progress export bundle ---------- */
export interface ProgressBundle {
  app: 'runlines';
  version: 1;
  exportedAt: number;
  scores: ScoreMap;
  srs: SrsMap;
  history: HistoryMap;
  edits: EditMap;
}
