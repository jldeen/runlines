import { useState } from 'react';
import type { ScoreVal } from '../types';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { scoreDelivery, type AccuracyResult } from '../lib/voice';
import { SCORE_META } from '../lib/scoring';

interface VoiceCheckProps {
  target: string;
  onScore: (v: ScoreVal) => void;
}

/**
 * Optional speech-recognition self-test: listen while the actor delivers the
 * covered line, then score word accuracy and suggest a recall rating.
 */
export function VoiceCheck({ target, onScore }: VoiceCheckProps) {
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();
  const [result, setResult] = useState<AccuracyResult | null>(null);

  if (!supported) return null;

  const finish = () => {
    stop();
    setResult(scoreDelivery(target, transcript));
  };

  return (
    <div className="voicecheck">
      {!listening ? (
        <button
          type="button"
          className="btn secondary"
          style={{ maxWidth: 240 }}
          onClick={() => {
            setResult(null);
            start();
          }}
        >
          🎤 Say it &amp; check
        </button>
      ) : (
        <button type="button" className="btn" style={{ maxWidth: 240 }} onClick={finish}>
          ⏹ Stop &amp; score
        </button>
      )}

      {listening && (
        <p className="voice-hint" aria-live="polite">
          Listening… {transcript ? `“${transcript}”` : 'deliver your line'}
        </p>
      )}

      {result && (
        <div className="voice-result" aria-live="polite">
          <p>
            <strong>{Math.round(result.accuracy * 100)}%</strong> of words matched ({result.matched}/
            {result.total}). Suggested: {SCORE_META[result.suggestion]}
          </p>
          <div className="voice-actions">
            {(['got', 'shaky', 'missed'] as ScoreVal[]).map((v) => (
              <button
                key={v}
                type="button"
                className={'iconbtn' + (v === result.suggestion ? ' sel' : '')}
                onClick={() => onScore(v)}
              >
                {SCORE_META[v]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
