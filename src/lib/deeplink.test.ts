import { describe, expect, it } from 'vitest';
import { sourceFromLocation, withSource } from './deeplink';

const SRC = 'https://github.com/octo/scripts/blob/main/demo.sk';

describe('deep link in the address bar', () => {
  it('points the page at the open script so a reload re-fetches it', () => {
    const next = new URL(withSource('https://runlines.app/', SRC));
    expect(sourceFromLocation(next)).toBe(SRC);
  });

  it('replaces a ?url= deep link when a different script is opened', () => {
    const next = new URL(withSource('https://runlines.app/?url=https%3A%2F%2Fexample.com%2Fold.sk', SRC));
    expect(next.searchParams.has('url')).toBe(false);
    expect(sourceFromLocation(next)).toBe(SRC);
  });

  it('keeps a matching ?url= deep link as given, and clears it for a new script', () => {
    const href = `https://runlines.app/?url=${encodeURIComponent(SRC)}`;
    expect(withSource(href, SRC)).toBe(href);
    expect(withSource(href, null)).toBe('https://runlines.app/');
  });
});
