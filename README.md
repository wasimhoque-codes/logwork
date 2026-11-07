# Gym Hawk

A personal, mobile-first tracker built around the [16-week beginner, back-conscious gym and calisthenics programme](docs/source-programme.md). Next.js, TypeScript and Cloudflare D1, deployed to Cloudflare Workers with OpenNext. Cloudflare Access restricts the hosted app to its owner. Workouts remain usable offline and sync when you reconnect.

## Run locally

Use Node.js 24 and npm:

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

On this Mac, if npm selects Linux native packages, use `npm ci --os=darwin --cpu=arm64`. Use ordinary `npm ci` on Cloudflare.

For an installable, offline-enabled Workers production preview:

```sh
npm run preview
```

## Programme features

- **16 weeks with explicit reviews:** four foundation weeks, hypertrophy base, relative-strength progression, consolidation and a Week 16 deload. Advance or repeat manually; time and logging never automatically change the week.
- **Focused mobile logging:** one working set at a time, kg/lb, reps or seconds, labelled Log set, load carry-forward, exact-setup previous-session reuse, optional actual RIR and draft-based edits. Add extra sets during a workout or later through History → Edit workout (up to 10 per exercise), or remove the final unlogged extra set. Saved-workout additions copy the preceding load and reps/seconds, start unlogged, and persist only with Save changes; Cancel or closing discards the draft. Future workouts retain their prescribed count. Exercise position and running/paused rest survive reloads.
- **Exercise history while training:** a secondary History link opens the five latest matching saved sessions with dated, numbered logged sets, weights, reps/seconds, actual RIR and extra-set labels. Matching uses the same exercise variation, load mode and equipment setup. History works offline and leaves logging inputs, edit drafts and rest timers intact.
- **Saved exercise choices:** leg press/belt squat, supported chest press, assisted/unassisted pull-ups and dips, seated/lying curls, bridge and push-up variations. Record equipment, support height and core variation. Choices affect future sessions only.
- **Calisthenics progression:** assistance, bodyweight repetitions and lever/setup changes are tracked separately from external load. Suggestions require all targets, controlled technique and acceptable workout/next-day responses; nothing automatically raises loads.
- **Saturday eligibility:** optional Mobility, Running and Walking for Weeks 1–4, one-set Upper C from Week 5, explicit two-set choice from Week 6, optional core from Week 9, and no Saturday lifting in Week 16. Knee raises require a per-session confirmation and offer dead bugs instead.
- **Rest days and workout feedback:** optional Mobility, Running and Walking suggestions without activity tracking; workout symptoms and technique observations. Unknown observations remain unknown. Preparation and cool-down checklists never become working sets.
- **Three clear destinations:** Today for daily actions, Programme for training choices, and Progress for an overview, history and detailed trends. Review and cool-down share one screen before a single save confirmation.
- **Progress dashboard:** named completion states, repeat-aware lift comparisons, exact-setup Load PRs, bodyweight trends, workout feedback and current-attempt volume. Lift cards open their exercise records; volume includes a muscle breakdown.
- **Bodyweight trends:** a compact seven-day snapshot opens the complete-history chart in an overlay, with real date spacing, a rolling average, latest weight and change since the first reading. Missing days are never estimated. Weekly summaries, same-date replacement, kg/lb, deletion and backups are retained.
- **Nutrition references:** the source programme’s surplus, protein, sleep and weight-gain targets. Plateau guidance needs consecutive completed weeks with enough weigh-ins; no maintenance calories are invented.
- **Fresh start:** version 4 starts at Week 1 with empty records and reset preferences. Tuesday defaults to the hip thrust machine, with floor glute bridge available as an alternative. Earlier browser keys are removed only after the new store saves successfully; new records survive reloads and updates. Only version-4 backups can be restored.
- **Offline and private:** exact production assets and local fonts are cached. IndexedDB stores your working copy and pending edits; D1 stores synced records. Conflicting edits are preserved for your review. There are no personal photos, photo reminders or camera or photo-upload features.

See [the full programme and tracking rules](docs/16-week-programme.md) and [the interface guide](docs/mobile-design.md).

## Data conventions and backups

Records save to IndexedDB on this device first and sync to a private Cloudflare D1 database. Sync runs on startup, reconnect, focus and while the visible app is open. Changes to separate records merge; edits to the same record require a choice. Version-4 localStorage data is migrated on first use and retained as a compatibility copy. Export a backup before clearing browser data.

Version-4 backups include programme attempts/options, active and finished workouts, bodyweight and preserved historical recovery activities. New recovery activities are no longer tracked. Imports validate the whole backup before confirmation and replacement. Daily habit tracking has been removed; loading or importing version-4 data discards saved check-ins and normalises the retired `daily` field to an empty array. Workout feedback and all other records are preserved. Invalid saved data is preserved and can be exported raw; an unreadable version-4 storage key never silently resets or falls back to older data.

Loads are stored in kilograms and converted for display/input. Dumbbell entries use one hand’s load. Unilateral values are per side; complete both sides before logging a set. Assistance is recorded as assistance and excluded from lifted-load volume. Volume is recorded external load × reps, excluding timed and bodyweight-only work, without doubling per-hand or per-side values. It is a consistent personal tracking measure rather than total biomechanical work.

Main-workout counts require every prescribed and added set and one completion per main workout type in the current programme attempt. Partial sessions, Wednesday recovery and optional Saturday are excluded. The calendar selector remains independent of programme weeks, so you can train on different days.

The app records your observations; it does not establish medical clearance. Its training guide retains source technique/modification guidance and links to [NHS back-pain guidance](https://www.nhs.uk/conditions/back-pain/).

## Validate and package

```sh
npm test
npm run build
npm run test:e2e
npm run build:worker
```

Playwright needs its Chromium browser installed. It tests the production preview on desktop and a phone. If a cloud-backed project folder stalls static-file reads, serve a byte-for-byte copy of `dist` from a local temporary directory and set `PW_BASE_URL` to that preview when running the browser suite.

The test suite covers existing programme rules and interface behavior plus database round-trips, atomic writes, stale edits, retry receipts, offline sync, restores and Access authentication. Older build counts in historical validation reports describe the previous static app.

Coverage includes phase prescriptions/boundaries, week attempts, deload totals, variations, assistance and symptom-based progression, fresh-start storage, old-backup rejection, history editing, bodyweight records, retired recovery-data compatibility, backups, offline reload, preparation checklists, sheet focus and layouts at 320×568, 390×844, tablet, desktop and a reduced keyboard viewport.

## Deploy to Cloudflare Workers

The target Worker is `logwork`, serving [logwork.wasimhoque16.workers.dev](https://logwork.wasimhoque16.workers.dev/). It uses the `DB` D1 binding. Production and preview databases must be different; local development uses an isolated Wrangler database.

Follow [Cloudflare setup, backup import and rollback](docs/cloudflare.md). Deployment fails closed until the database ID and owner Access configuration are supplied outside the repository. Personal backups are never included in the build.
