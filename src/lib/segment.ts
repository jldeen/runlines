// Split a beat's narrative into sentence-ish bullets (no lookbehind, iOS-safe).
export function segmentSentences(text: string): string[] {
  const out: string[] = [];
  text.split(/\n+/).forEach((line) => {
    line = line.trim();
    if (!line) return;
    const re = /[^.!?…]+[.!?…]*(?:\s+|$)/g;
    let m: RegExpExecArray | null;
    let any = false;
    while ((m = re.exec(line))) {
      const s = m[0].trim();
      if (s) {
        out.push(s);
        any = true;
      }
    }
    if (!any) out.push(line);
  });
  return out.length ? out : [text.trim()];
}
