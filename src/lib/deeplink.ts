function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The script link in a deep link: `?url=` or `#url=`. */
export function sourceFromLocation(loc: { search: string; hash: string }): string {
  const u = new URLSearchParams(loc.search).get('url');
  if (u) return u;
  return loc.hash.startsWith('#url=') ? safeDecode(loc.hash.slice(5)) : '';
}

/**
 * `href` pointing at `src` (or at no script), so reloading the page re-fetches the
 * script that's open instead of losing it. A matching `?url=` deep link is kept as is.
 */
export function withSource(href: string, src: string | null): string {
  const u = new URL(href);
  if (src && u.searchParams.get('url') === src) return href;
  u.searchParams.delete('url');
  u.hash = src ? `url=${encodeURIComponent(src)}` : '';
  return u.toString();
}
