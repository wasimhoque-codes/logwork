# Gym Hawk

A personal, mobile-first tracker built around the [16-week beginner, back-conscious gym and calisthenics programme](docs/source-programme.md). React, TypeScript and Vite; a static app for Cloudflare Pages. No backend, account, API key or subscription is required.

## Run locally

Use Node.js 22.12+ or 24 and npm:

```sh
npm ci
npm run dev
```

On this Mac, if npm selects Linux native packages, use `npm ci --os=darwin --cpu=arm64`. Use ordinary `npm ci` on Cloudflare.

For an installable, offline-enabled production preview:

```sh
npm run build
npm run preview
```

## Programme features

- **16 weeks with explicit reviews:** four foundation weeks, hypertrophy base, relative-strength progression, consolidation and a Week 16 deload. Advance or repeat manually; time and logging never automatically change the week.
- **Focused mobile logging:** one working set at a time, kg/lb, reps or seconds, labelled Log set, load carry-forward, exact-setup previous-session reuse, optional actual RIR and draft-based edits. Add extra sets during a workout or later through History → Edit workout (up to 10 per exercise), or remove the final unlogged extra set. Saved-workout additions copy the preceding load and reps/seconds, start unlogged, and persist only with Save changes; Cancel or closing discards the draft. Future workouts retain their prescribed count. Exercise position and running/paused rest survive reloads.
- **Exercise history while training:** a secondary History link opens the five latest matching saved sessions with dated, numbered logged sets, weights, reps/seconds, actual RIR and extra-set labels. Matching uses the same exercise variation, load mode and equipment setup. History works offline and leaves logging inputs, edit drafts and rest timers intact.
- **Saved exercise choices:** leg press/belt squat, supported chest press, assisted/unassisted pull-ups and dips, seated/lying curls, bridge and push-up variations. Record equipment, support height and core variation. Choices affect future sessions only.
- **Calisthenics progression:** assistance, bodyweight repetitions and lever/setup changes are tracked separately from external load. Suggestions require all targets, controlled technique and acceptable workout/next-day responses; nothing automatically raises loads.
- **Saturday eligibility:** walking/mobility for Weeks 1–4, one-set Upper C from Week 5, explicit two-set choice from Week 6, optional core from Week 9, and no Saturday lifting in Week 16. Knee raises require a per-session confirmation and offer dead bugs instead.
- **Recovery and workout feedback:** walking/cycling and mobility minutes, workout symptoms and technique observations. Unknown observations remain unknown. Preparation and cool-down checklists never become working sets.
- **Three clear destinations:** Today for daily actions, Programme for training choices, and Progress for an overview, history and detailed trends. Review and cool-down share one screen before a single save confirmation.
- **Nutrition references:** the source programme’s surplus, protein, sleep and weight-gain targets. Plateau guidance needs consecutive completed weeks with enough weigh-ins; no maintenance calories are invented.
- **Fresh start:** version 4 starts at Week 1 with empty records and reset preferences. Tuesday defaults to the hip thrust machine, with floor glute bridge available as an alternative. Earlier browser keys are removed only after the new store saves successfully; new records survive reloads and updates. Only version-4 backups can be restored.
- **Offline and private:** exact production assets and local fonts are cached. Records stay in browser storage. There are no personal photos, photo reminders or camera or photo-upload features.

See [the full programme and tracking rules](docs/16-week-programme.md) and [the interface guide](docs/mobile-design.md).

## Data conventions and backups

Data lives in `localStorage` on the current browser and device. There is no automatic cross-device sync. Export a backup before changing devices or clearing browser data.

Version-4 backups include programme attempts/options, active and finished workouts, bodyweight and recovery activities. Imports validate the whole backup before confirmation and replacement. Daily habit tracking has been removed; loading or importing version-4 data discards saved check-ins and normalises the retired `daily` field to an empty array. Workout feedback and all other records are preserved. Invalid saved data is preserved and can be exported raw; an unreadable version-4 storage key never silently resets or falls back to older data.

Loads are stored in kilograms and converted for display/input. Dumbbell entries use one hand’s load. Unilateral values are per side; complete both sides before logging a set. Assistance is recorded as assistance and excluded from lifted-load volume. Volume is recorded external load × reps, excluding timed and bodyweight-only work, without doubling per-hand or per-side values. It is a consistent personal tracking measure rather than total biomechanical work.

Main-workout counts require every prescribed and added set and one completion per main workout type in the current programme attempt. Partial sessions, Wednesday recovery and optional Saturday are excluded. The calendar selector remains independent of programme weeks, so you can train on different days.

The app records your observations; it does not establish medical clearance. Its training guide retains source technique/modification guidance and links to [NHS back-pain guidance](https://www.nhs.uk/conditions/back-pain/).

## Validate and package

```sh
npm test
npm run build
npm run test:e2e
python3 scripts/package.py
```

Playwright needs its Chromium browser installed. It tests the production preview on desktop and a phone. If a cloud-backed project folder stalls static-file reads, serve a byte-for-byte copy of `dist` from a local temporary directory and set `PW_BASE_URL` to that preview when running the browser suite.

The current production build passes **92 model tests and 72 browser checks**. See [the validation report](docs/validation.md) for exact build identifiers and package verification.

Coverage includes phase prescriptions/boundaries, week attempts, deload totals, variations, assistance and symptom-based progression, fresh-start storage, old-backup rejection, history editing, bodyweight/recovery records, backups, offline reload, preparation checklists, sheet focus and layouts at 320×568, 390×844, tablet, desktop and a reduced keyboard viewport.

## Deploy to Cloudflare Pages

Build and package the app, then upload `gym-hawk-pages.zip` or the contents of `dist/` through **Workers & Pages → Create → Pages → Upload assets**. Open the resulting Pages URL on your phone and add it to your home screen. Deployment is separate from local implementation and validation.

For Git-based builds:

| Setting | Value |
| --- | --- |
| Framework preset | React (Vite) |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `NODE_VERSION=22` |

The app uses static assets and hash-based routes, with no Pages Functions, secrets or database bindings. `public/_headers` provides cache and security headers. Each build regenerates `sw.js`; updates remove only older Gym Hawk asset caches and preserve browser records.
