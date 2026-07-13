// Split a beat's narrative into sentence-ish bullets (no lookbehind, iOS-safe).
export function segmentSentences(text: string): string[] {
  const out: string[] = [];
  text.split(/\n+/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    // A sentence boundary is one or more terminators (. ! ? …) followed by
    // whitespace or end-of-line. Splitting only at whitespace-backed
    // terminators keeps decimals ("$1.5"), URLs, and "e.g." intact — and,
    // crucially, never drops characters the way a greedy token match can.
    const re = /[.!?…]+(?=\s|$)/g;
    const parts: string[] = [];
    let start = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const end = m.index + m[0].length;
      const seg = line.slice(start, end).trim();
      if (seg) parts.push(seg);
      start = end;
    }
    if (start < line.length) {
      const seg = line.slice(start).trim();
      if (seg) parts.push(seg);
    }
    if (parts.length) out.push(...parts);
    else out.push(line);
  });
  return out.length ? out : [text.trim()];
}
