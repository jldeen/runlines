import type { Deck } from '../types';

/** github.com/<o>/<r>/blob/<ref>/<path> -> raw.githubusercontent.com/<o>/<r>/<ref>/<path> */
export function toRaw(u: string): string {
  u = u.trim();
  if (!u) return u;
  const m = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  return u;
}

/** Coerce any value to a trimmed string (fixes crash on non-string .sk fields). */
function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

export function parseScript(text: string): Deck {
  text = text.replace(/^\uFEFF/, '');
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (data && typeof data === 'object' && Array.isArray((data as { rows?: unknown }).rows)) {
    const d = data as { title?: unknown; description?: unknown; rows: unknown[] };
    const beats = d.rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        time: str(r.time),
        narrative: str(r.narrative),
        cue: str(r.demo_actions),
      }))
      .filter((b) => b.narrative.length > 0);
    return {
      title: str(d.title) || 'Untitled script',
      description: str(d.description),
      beats,
    };
  }

  // Fallback: plain text. Split on blank lines into beats.
  const chunks = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const beats = chunks.map((c) => ({ time: '', narrative: c, cue: '' }));
  return { title: 'Pasted script', description: '', beats };
}
