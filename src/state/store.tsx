import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { Deck, ScoreVal, ViewMode } from '../types';
import {
  getAllScores,
  getDeckScores,
  getSavedState,
  getSavedView,
  saveAllScores,
  saveState,
  saveView,
  scriptKey,
} from '../lib/storage';

export interface RunState {
  deck: Deck | null;
  idx: number;
  level: number;
  order: number[] | null; // shuffle / review order of ORIGINAL beat indices
  reviewMode: boolean;
  viewMode: ViewMode;
  covered: boolean;
  revealAll: boolean;
  scores: Record<string, ScoreVal>; // for current deck, keyed by original beat idx
}

type Action =
  | { type: 'LOAD_DECK'; deck: Deck }
  | { type: 'RESET' }
  | { type: 'GO'; delta: number }
  | { type: 'START_OVER' }
  | { type: 'SET_LEVEL'; level: number }
  | { type: 'SET_VIEW'; view: ViewMode }
  | { type: 'SET_COVER'; on: boolean }
  | { type: 'REVEAL_ALL' }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'SET_SCORE'; beatIndex: number; val: ScoreVal | null }
  | { type: 'START_REVIEW'; order: number[] }
  | { type: 'EXIT_REVIEW'; silent: boolean }
  | { type: 'RESET_SCORES' }
  | { type: 'JUMP_TO_ORIGINAL'; origIdx: number };

export function activeLen(s: RunState): number {
  if (s.order) return s.order.length;
  return s.deck ? s.deck.beats.length : 0;
}

export function currentBeatIndex(s: RunState): number {
  return s.order ? s.order[s.idx] : s.idx;
}

function clampIdx(idx: number, len: number): number {
  return Math.max(0, Math.min(len - 1, idx));
}

function reducer(s: RunState, a: Action): RunState {
  switch (a.type) {
    case 'LOAD_DECK': {
      const view = getSavedView();
      const scores = getDeckScores(a.deck);
      // Restore saved position if it belongs to this exact script.
      const saved = getSavedState();
      const key = scriptKey(a.deck);
      let idx = 0;
      let level = 0;
      if (saved && saved.key === key) {
        idx = clampIdx(saved.idx, a.deck.beats.length);
        level = Math.max(0, Math.min(5, saved.level));
      }
      return {
        deck: a.deck,
        idx,
        level,
        order: null,
        reviewMode: false,
        viewMode: view,
        covered: false,
        revealAll: false,
        scores,
      };
    }
    case 'RESET':
      return { ...initialState };
    case 'GO': {
      const len = activeLen(s);
      const idx = clampIdx(s.idx + a.delta, len);
      return { ...s, idx, covered: false, revealAll: false };
    }
    case 'START_OVER':
      return { ...s, idx: 0, covered: false, revealAll: false };
    case 'SET_LEVEL':
      return { ...s, level: a.level, revealAll: false };
    case 'SET_VIEW':
      saveView(a.view);
      return { ...s, viewMode: a.view, covered: false, revealAll: false };
    case 'SET_COVER':
      return { ...s, covered: a.on };
    case 'REVEAL_ALL':
      return { ...s, covered: false, revealAll: true };
    case 'TOGGLE_SHUFFLE': {
      if (!s.deck) return s;
      if (s.order && !s.reviewMode) {
        return { ...s, order: null, idx: 0, covered: false, revealAll: false };
      }
      const order = s.deck.beats.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      return { ...s, order, idx: 0, reviewMode: false, covered: false, revealAll: false };
    }
    case 'SET_SCORE': {
      const scores = { ...s.scores };
      const k = String(a.beatIndex);
      if (a.val === null) delete scores[k];
      else scores[k] = a.val;
      return { ...s, scores };
    }
    case 'START_REVIEW':
      return {
        ...s,
        order: a.order,
        idx: 0,
        reviewMode: true,
        covered: false,
        revealAll: false,
      };
    case 'EXIT_REVIEW': {
      if (!s.reviewMode) return s;
      if (a.silent) return { ...s, reviewMode: false };
      return { ...s, reviewMode: false, order: null, idx: 0, covered: false, revealAll: false };
    }
    case 'RESET_SCORES':
      return { ...s, scores: {}, reviewMode: false, order: null, idx: 0 };
    case 'JUMP_TO_ORIGINAL': {
      let idx = a.origIdx;
      if (s.order) {
        const p = s.order.indexOf(a.origIdx);
        idx = p >= 0 ? p : 0;
      }
      return { ...s, idx, covered: false, revealAll: false };
    }
    default:
      return s;
  }
}

const initialState: RunState = {
  deck: null,
  idx: 0,
  level: 0,
  order: null,
  reviewMode: false,
  viewMode: 'lines',
  covered: false,
  revealAll: false,
  scores: {},
};

interface StoreValue {
  state: RunState;
  dispatch: React.Dispatch<Action>;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist position (keyed to the exact script).
  useEffect(() => {
    if (!state.deck) return;
    saveState({ key: scriptKey(state.deck), idx: state.idx, level: state.level });
  }, [state.deck, state.idx, state.level]);

  // Persist scores for this deck into the global score map.
  useEffect(() => {
    if (!state.deck) return;
    const all = getAllScores();
    const key = scriptKey(state.deck);
    if (Object.keys(state.scores).length === 0) delete all[key];
    else all[key] = state.scores;
    saveAllScores(all);
  }, [state.deck, state.scores]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error('useStore must be used within StoreProvider');
  return v;
}
