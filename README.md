# RunLines

A fast, mobile-first web app for memorizing lines from a script.

Load a `.sk` narrative script straight from a GitHub link, then run your lines with
stage cues, tap-to-reveal, and a progressive word-fade slider.

## Features

- **Load from GitHub** — paste any GitHub file URL to a `.sk` script; it's auto-converted to raw and parsed.
- **Beats** — each `rows[].narrative` becomes a beat, shown with its stage cue (`demo_actions`) and target `time`.
- **Progressive fade** — 6 levels: Full text → Light fade → Half gone → First letters → Ghost → Blackout.
- **Study modes** — switch each beat between **Lines** (prose), **Bullets** (one point per sentence), and **Cards** (flip notecards: stage cue on the front, line on the back). The fade slider works in every mode; your mode choice is remembered.
- **Tap to peek** — tap any faded word to reveal it.
- **Cover mode** — deliver a beat from memory, then reveal to check.
- **Teleprompter** — a full-screen, large-text scrolling view of the whole script (in **Lines** or **Bullets**), with play/pause auto-scroll, adjustable speed and font size, a **Normal / Mirror** option (mirror for teleprompter glass), and tap-to-pause. Space toggles play; ↑/↓ change speed; Esc closes.
- **Start over** — jump back to the first beat anytime.
- **Export note cards (.pptx / .pdf)** — export the whole script as note cards in **PowerPoint** or **PDF**: **white text on black**, one beat per card (long beats split so bullets always fit), with adjustable bullets-per-card, font size, and optional stage cue. Great for printing or a second-screen prompter.
- **Self-scoring** — after each beat, rate your recall (Got it / Shaky / Missed). See a session summary and jump into a **review pass** that loops just your weak beats, worst-first. Scores persist locally per script (keyed to the script's content, so different scripts never collide).
- **Spaced repetition** — every rating schedules that beat's next review (Leitner boxes tuned for fast, hours-long memorization). A **Practice due** pass surfaces exactly the beats that are due, soonest first, plus any you haven't seen yet.
- **Pace timer** — a live per-beat delivery timer compares your elapsed time against the beat's target `time` and flags when you run long, so your timing tightens as you rehearse.
- **Hint ladder** — a per-beat **Hint** button reveals a little more of the current line on demand, independent of the global fade slider; it resets when you move on.
- **Voice self-test** — where speech recognition is available, deliver a covered line out loud and RunLines scores your word accuracy and suggests a rating.
- **Cue-only drill** — a hands-free **Drill** that speaks each stage cue aloud, gives you a few seconds to deliver the line from memory, reveals it to self-check, then auto-advances.
- **Edit beats inline** — tweak a beat's line or cue without a round-trip to GitHub; overrides persist locally and can be reverted.
- **Session history & backup** — save run snapshots (percent recalled over time) and **export / import your progress** as JSON to move it between devices.
- **Offline scripts** — a loaded `.sk` is cached so it re-opens even with no connection; cached scripts show an **✓ offline** tag in your recents.
- **Shuffle**, **cue voice** (text-to-speech of the stage direction), and progress tracking.
- **Deep links** — `?url=<github-link>` opens straight into a script.
- **Installable PWA** — add it to your phone home screen; the app shell works offline (scripts are still fetched live when you're online).
- **Responsive** — adapts from small phones to tablets and desktops; Prev/Next live in a fixed bottom bar so they never move or get clipped, and wide screens get a two-column practice layout.
- **Accessible** — modal dialogs trap focus and restore it, faded words are keyboard-operable and never leak the answer to screen readers, controls expose pressed state, and it honors `prefers-reduced-motion`.
- Recent scripts and your position are saved locally.

## Script format (`.sk`)

JSON with a `rows` array. Each row:

```json
{
  "title": "My Script",
  "rows": [
    { "time": "~35s", "narrative": "The line you speak…", "demo_actions": "Stage direction / cue" }
  ]
}
```

Plain text (blank-line-separated beats) also works via the paste box.

## Architecture

RunLines is a **Vite + React + TypeScript** single-page app. Logic is split into
focused modules under `src/`:

- `lib/parse.ts` — GitHub-URL→raw conversion and `.sk` / plain-text parsing (validated).
- `lib/mask.ts` — fade levels, deterministic per-beat word masking (Unicode-aware).
- `lib/segment.ts` — iOS-safe sentence segmentation for bullets.
- `lib/scoring.ts` — recall counts and the weak-beats review order.
- `lib/srs.ts` — Leitner spaced-repetition scheduling and the "practice due" order.
- `lib/voice.ts` — bag-of-words delivery scoring for the voice self-test.
- `lib/progress.ts` — export / import of all local progress as a JSON bundle.
- `lib/storage.ts` — safe localStorage helpers and content-hash script keys.
- `lib/pptx.ts` / `lib/pdf.ts` — PowerPoint and PDF note-card export (both lazy-loaded).
- `hooks/useSpeechRecognition.ts` — feature-detected Web Speech API wrapper.
- `state/store.tsx` — the app store (`useReducer` + context) with persistence.
- `components/` — UI (Loader, Runner, Teleprompter, PaceTimer, dialogs, masked text, …).

The PWA (manifest + offline service worker) is generated by `vite-plugin-pwa`.
Cross-origin script fetches (`raw.githubusercontent.com`) are never cached, so
lines are always live.

## Develop / build

```bash
npm install
npm run dev       # dev server on http://localhost:8765
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build
```

## Deploy

Vercel auto-detects the Vite framework — no configuration needed:

- **Build command:** `vite build` (default)
- **Output directory:** `dist` (default)

## Usage

Deep-link into a script:

```
https://<your-deploy>/?url=https://github.com/user/repo/blob/main/path/to/script.sk
```
