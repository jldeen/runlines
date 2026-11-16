# RunLines

A fast, mobile-first web app for memorizing lines from a script.

Load a `.sk` narrative script straight from a GitHub link, then run your lines with
stage cues, tap-to-reveal, and a progressive word-fade slider.

## Features

- **Load from GitHub** — paste any GitHub file URL to a `.sk` script; it's auto-converted to raw and parsed.
- **Private repos** — **Sign in with GitHub** (or paste a read-only token) to load scripts from a private repo, on desktop and phone. See [Private repos](#private-repos).
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
- `lib/github.ts` — GitHub link parsing, private-repo reads via the contents API, sign-in and token refresh.
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
- `api/github/device.ts` — Vercel Function that proxies GitHub's device-flow sign-in (also served by `npm run dev`).

The PWA (manifest + offline service worker) is generated by `vite-plugin-pwa`.
Script fetches (`raw.githubusercontent.com`, `api.github.com`) are never cached by
the service worker, so lines are always live.

## Develop / build

```bash
npm install
cp .env.example .env.local   # optional: add your GitHub App client ID
npm run dev       # dev server on http://localhost:8765
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build
```

## Deploy

Vercel auto-detects the Vite framework — no configuration needed:

- **Build command:** `vite build` (default)
- **Output directory:** `dist` (default)
- **Environment variable (optional):** `VITE_GITHUB_CLIENT_ID` for GitHub sign-in (Production and Preview).

## Private repos

Raw links to private repos return 404 without credentials. Sign in once per device
and RunLines reads private files through the GitHub API instead.

**Option A: Sign in with GitHub (recommended).** Uses a GitHub App that can only read
file contents in the repos you pick. Works in the installed phone app too: you
enter a short code on github.com, no redirects.

One-time setup:

1. Go to [github.com/settings/apps/new](https://github.com/settings/apps/new):
   - **GitHub App name:** anything unique, e.g. `RunLines (your-name)`.
   - **Homepage URL:** your deployment URL. Leave **Callback URL** empty.
   - Keep **Expire user authorization tokens** selected.
   - Select **Enable Device Flow**.
   - Under **Webhook**, deselect **Active**.
   - **Repository permissions → Contents:** `Read-only`. Leave everything else as is.
   - **Where can this GitHub App be installed?** `Only on this account`.
2. Click **Create GitHub App** and copy its **Client ID** (not the App ID). You don't need a
   client secret or private key.
3. In the app's sidebar, click **Install App**. Install it on your account with
   **Only select repositories**, and pick the repo that holds your scripts.
4. Set `VITE_GITHUB_CLIENT_ID` to the Client ID in Vercel (Production and Preview), then
   redeploy. For local dev, put it in `.env.local`.

Then, on each device, open RunLines, tap **Sign in with GitHub**, and approve the code on
github.com. To give RunLines access to another repo later, add it at
[github.com/settings/installations](https://github.com/settings/installations).

**Option B: paste a token.** Under **Use a GitHub token**, paste a
[fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
with **Only select repositories** (your scripts repo) and **Contents: Read-only**. This
works without any setup.

How your credentials are handled:

- The token is stored in this browser's local storage only, sent only to `api.github.com`,
  and never included in progress exports.
- `/api/github/device` forwards the public client ID and the device code or refresh token
  to github.com for sign-in. It holds no secret and stores nothing.
- Sign-in tokens expire after 8 hours and refresh automatically for up to 6 months.
- **Sign out** removes the token from the device. To revoke it everywhere, go to
  [github.com/settings/apps/authorizations](https://github.com/settings/apps/authorizations)
  (or delete the personal access token).
- Scripts you've opened stay cached for offline rehearsal after you sign out.

## Usage

Deep-link into a script:

```
https://<your-deploy>/?url=https://github.com/user/repo/blob/main/path/to/script.sk
```

Private links work the same way once you're signed in on that device. If you open one
before signing in, sign in and it loads automatically.
