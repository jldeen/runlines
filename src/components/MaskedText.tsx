import { useEffect, useState, type ReactNode } from 'react';
import { hintFor, isWordish, maskedWordSet, tokenize, type Level } from '../lib/mask';

interface MaskedTextProps {
  text: string;
  seed: number;
  level: Level;
  makeParas: boolean;
  revealAll: boolean;
  /** changes whenever the beat/level/view resets so local reveals clear */
  resetKey: string;
}

function firstCore(word: string): string {
  const m = word.match(/[\p{L}\p{N}]/u) || word.match(/[A-Za-z0-9]/);
  return m ? m[0] : '';
}

export function MaskedText({ text, seed, level, makeParas, revealAll, resetKey }: MaskedTextProps) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  useEffect(() => {
    setRevealed(new Set());
  }, [resetKey]);

  const toks = tokenize(text);
  const words = toks.filter((t) => t.t === 'word').map((t) => (t as { v: string }).v);
  const maskedSet = maskedWordSet(words, level, seed);

  const paras: ReactNode[][] = [[]];
  let wordK = -1;
  let nodeKey = 0;

  const pushSpace = (v: string) => {
    paras[paras.length - 1].push(<span key={nodeKey++}>{v}</span>);
  };

  toks.forEach((t) => {
    if (t.t === 'break') {
      if (makeParas) paras.push([]);
      else pushSpace(' ');
      return;
    }
    if (t.t === 'space') {
      pushSpace(t.v);
      return;
    }
    // word
    wordK++;
    const k = wordK;
    const v = t.v;
    const isMasked = maskedSet.has(k);
    const key = nodeKey++;

    if (!isMasked) {
      const cls = 'w' + (isWordish(v) ? '' : ' punct');
      paras[paras.length - 1].push(
        <span key={key} className={cls}>
          {v}
        </span>,
      );
      return;
    }

    const shown = revealAll || revealed.has(k);
    if (shown) {
      paras[paras.length - 1].push(
        <span key={key} className="w revealed">
          {v}
        </span>,
      );
      return;
    }

    const hint = hintFor(v, level.firstLetter);
    const core = firstCore(v);
    const label = core ? `hidden word, starts with ${core}` : 'hidden word';
    paras[paras.length - 1].push(
      <button
        key={key}
        type="button"
        className="w masked"
        data-hint={hint}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setRevealed((prev) => {
            const next = new Set(prev);
            next.add(k);
            return next;
          });
        }}
      >
        <span aria-hidden="true">{v}</span>
      </button>,
    );
  });

  if (makeParas) {
    return (
      <>
        {paras.map((nodes, i) => (
          <p className="para" key={i}>
            {nodes}
          </p>
        ))}
      </>
    );
  }
  return <>{paras[0]}</>;
}
