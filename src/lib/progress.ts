import type { ProgressBundle } from '../types';
import {
  getAllEdits,
  getAllHistory,
  getAllScores,
  getAllSrs,
  saveAllEdits,
  saveAllHistory,
  saveAllScores,
  saveAllSrs,
} from './storage';

/** Gather all persisted practice data into a single portable bundle. */
export function exportProgress(): ProgressBundle {
  return {
    app: 'runlines',
    version: 1,
    exportedAt: Date.now(),
    scores: getAllScores(),
    srs: getAllSrs(),
    history: getAllHistory(),
    edits: getAllEdits(),
  };
}

/** Trigger a browser download of the current progress as JSON. */
export function downloadProgress(): void {
  const bundle = exportProgress();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `runlines-progress-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Merge an imported bundle into local storage. Imported script keys overwrite
 * matching local keys; other local data is preserved. Returns the number of
 * script keys merged, or throws on an invalid bundle.
 */
export function importProgress(raw: string): number {
  const data = JSON.parse(raw) as Partial<ProgressBundle>;
  if (!isRecord(data) || data.app !== 'runlines') {
    throw new Error('Not a RunLines progress file.');
  }
  let merged = 0;
  if (isRecord(data.scores)) {
    const all = getAllScores();
    for (const k of Object.keys(data.scores)) {
      all[k] = data.scores[k];
      merged++;
    }
    saveAllScores(all);
  }
  if (isRecord(data.srs)) {
    const all = getAllSrs();
    for (const k of Object.keys(data.srs)) all[k] = data.srs[k];
    saveAllSrs(all);
  }
  if (isRecord(data.history)) {
    const all = getAllHistory();
    for (const k of Object.keys(data.history)) {
      const v = (data.history as Record<string, unknown>)[k];
      if (Array.isArray(v)) all[k] = v;
    }
    saveAllHistory(all);
  }
  if (isRecord(data.edits)) {
    const all = getAllEdits();
    for (const k of Object.keys(data.edits)) all[k] = data.edits[k];
    saveAllEdits(all);
  }
  return merged;
}
