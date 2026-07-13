# RunLines

A fast, mobile-first web app for memorizing lines from a script.

Load a `.sk` narrative script straight from a GitHub link, then run your lines with
stage cues, tap-to-reveal, and a progressive word-fade slider.

## Features

- **Load from GitHub** — paste any GitHub file URL to a `.sk` script; it's auto-converted to raw and parsed.
- **Beats** — each `rows[].narrative` becomes a beat, shown with its stage cue (`demo_actions`) and target `time`.
- **Progressive fade** — 6 levels: Full text → Light fade → Half gone → First letters → Ghost → Blackout.
- **Tap to peek** — tap any faded word to reveal it.
- **Cover mode** — deliver a beat from memory, then reveal to check.
- **Self-scoring** — after each beat, rate your recall (Got it / Shaky / Missed). See a session summary and jump into a **review pass** that loops just your weak beats, worst-first. Scores persist locally per script.
- **Shuffle**, **cue voice** (text-to-speech of the stage direction), and progress tracking.
- **Deep links** — `?url=<github-link>` opens straight into a script.
- **Installable PWA** — add it to your phone home screen; the app shell works offline (scripts are still fetched live when you're online).
- Recent scripts and your position are saved locally. Fully static, no backend.

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

## Run locally

Any static server works:

```bash
python3 -m http.server 8770
# open http://localhost:8770
```

## Deploy

It's a single static `index.html` — deploy to Vercel or Netlify with no build step.

- **Vercel:** import the repo (Framework preset: **Other**, no build command, output dir `.`).
- **Netlify:** drag the folder to app.netlify.com/drop, or connect the repo.

## Usage

Deep-link into a script:

```
https://<your-deploy>/?url=https://github.com/user/repo/blob/main/path/to/script.sk
```
