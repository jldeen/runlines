import { useEffect } from 'react';

function isInteractiveTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
  if (t.isContentEditable) return true;
  return false;
}

export interface KeyHandlers {
  onLeft?: () => void;
  onRight?: () => void;
  onSpace?: () => void;
  onEscape?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  /** When false, arrow/space handlers that would conflict with a focused control are skipped. */
  guardTargets?: boolean;
}

/**
 * Global keyboard handler that ignores events originating from form controls /
 * buttons so shortcuts don't hijack slider, buttons, or text fields.
 */
export function useKeyboard(handlers: KeyHandlers, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const guard = handlers.guardTargets !== false;
      const interactive = guard && isInteractiveTarget(e.target);
      switch (e.key) {
        case 'Escape':
          handlers.onEscape?.();
          break;
        case 'ArrowRight':
          if (interactive) return;
          handlers.onRight?.();
          break;
        case 'ArrowLeft':
          if (interactive) return;
          handlers.onLeft?.();
          break;
        case 'ArrowUp':
          if (interactive) return;
          if (handlers.onUp) {
            e.preventDefault();
            handlers.onUp();
          }
          break;
        case 'ArrowDown':
          if (interactive) return;
          if (handlers.onDown) {
            e.preventDefault();
            handlers.onDown();
          }
          break;
        case ' ':
          if (interactive) return;
          if (handlers.onSpace) {
            e.preventDefault();
            handlers.onSpace();
          }
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handlers, enabled]);
}
