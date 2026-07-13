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
