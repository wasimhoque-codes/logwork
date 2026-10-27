# Gym Hawk ivory and teal design validation

Validated on 27 October 2026 against the final production build. This redesign changes presentation only; version-4 storage, routes, prescriptions and existing extra-set behaviour are preserved.

- TypeScript and production build: passed (`npm run build`); final visual assets regenerated with Vite after the last touch-target adjustment.
- Model tests: 92 passed across 5 files (`npm test`).
- Full browser suite: 72 passed across desktop and mobile Chromium (`npm run test:e2e`). This includes offline logging, service-worker updates, backups, history, extra sets, keyboard clearance, enlarged text and focus return.
- Final visual review: 44 captures across 320×568, 390×844, 768×1000 and 1440×1000. Today, Programme, populated Progress, bodyweight charts, settings, logger/rest, review, confirmation, record details and the bodyweight sheet were reviewed. Captures and contact sheets are in `artifacts/ivory-teal/`.
- Layout audit: no horizontal overflow or buttons, links or disclosure controls below 44×44px in the 44 captured states. At 320px, the complete current-set inputs fit above the action dock and the weekly total fits above navigation. Reduced-motion transitions are disabled.
- Theme: one semantic variable definition; local Manrope headings and DM Sans body text; themed chart strokes, grid and fill. Invalid focused inputs retain red borders/background and focus rings. Notification dismiss controls are at least 44×44px.
- Contrast ratios: ink on ivory 13.95:1; muted text on ivory 5.11:1; white on teal 4.99:1; dark teal text on mint 6.07:1; hero metadata on forest 7.60:1; forest text on mint action 9.67:1.
- Local preview: `http://127.0.0.1:4174/`.
- Deployment follow-up: successfully published on 27 October 2026 at [Gym Hawk](https://gym-hawk.daringberry12.chatgpt.site), retaining private access. Both the deployment archive and `gym-hawk-pages.zip` were verified against all 11 tested production files.

Build assets: `assets/index-r7QwClys.js`, `assets/index-D-tynMpY.css`, with both local fonts cached offline.
Service-worker SHA-256: `c57abd806f0d7851a8236d84de4c9f9ff4d865423c1d69c6a5da5908e1e5eaec`.

Physical-device Safari/VoiceOver testing was not performed.

---

# Gym Hawk extra-set validation

Validated on 27 October 2026 against the production build. Storage key `gym-hawk-v4` and backup version 4 are unchanged.

- Production build: passed (`npm run build`).
- Model tests: 92 passed across 5 files (`npm test`).
- Browser suite: 72 passed, covering 36 scenarios on desktop Chromium and iPhone-size Chromium emulation (`npm run test:e2e`).
- Added sets: session-only additions, ten-set limit, last-set values, cleared RIR/completion, edit-draft preservation, Undo and removal of the final unlogged extra all passed.
- Data: active and finished extras survive reload, offline logging, history edits and backup export/import. Future set counts and prescribed snapshots remain unchanged; existing v4 records still load.
- Programme: extra sets count towards completion and recorded volume, retain progression checks, and do not alter the programme's weekly bonus-set accounting.
- Mobile review: extra-set screenshots at 320×568 and 390×844 were visually inspected. Automated checks cover dock clearance, focus and horizontal overflow. Screenshots are in `test-results/app-add-set-controls-and-f-16579-e-the-dock-on-narrow-phones-{desktop,mobile}/`.
- Local package: `python3 scripts/package.py` verified all 10 ZIP files against the tested `dist` bytes. No deployment was performed.

Build assets: `assets/index-BuAxzZYB.js`, `assets/index-BsY4z92n.css`.
Service-worker SHA-256: `f2bd102bbd1c003e948d5cf2451fe276c4902e4e3b377b7660d716a9446a532d`.
ZIP: 156,306 bytes; SHA-256 `6305b9448d9188f70db609b63f475869d2ff36fc741d5517c8372244902ac1df`.

Physical-device Safari/VoiceOver testing was not performed.

---

# Gym Hawk check-in removal validation

Validated on 26 October 2026 against the production build. Storage key `gym-hawk-v4` and backup version 4 are unchanged. This update does not reset programme progress or other records.

| Check | Result |
| --- | --- |
| TypeScript and Vite production build | Passed |
| Model tests | 81 passed across 4 files |
| Production Playwright suite | 62 passed: 31 scenarios on desktop Chromium and iPhone-size Chromium emulation |
| Daily tracking removed from Today and Progress Recovery | Passed |
| Load/import cleanup and preservation of all other version-4 data | Passed |
| Bodyweight logging, same-date replacement, deletion, units and charts | Passed |
| Offline workout/bodyweight logging, reload and backup restore | Passed |
| Storage-write failures and older-client storage events | Passed |
| Service-worker upgrade retaining version-4 records | Passed |
| Production build and ZIP | All 10 files identical byte for byte |

## Data and feature removal

The active app no longer includes the Daily check-in form, save handlers/status messages, Habit consistency statistics, shortcut, props, habit styles or daily symptom pre-filling. General nutrition/training references, workout-specific before/after/next-day symptoms, technique feedback and recovery activities remain available.

Loading or importing populated version-4 check-ins discards only those records and returns `daily: []`. The field remains empty in new backups for compatibility. Tests compare entire stores before and after cleanup, including saved and active workouts, existing workout symptoms, bodyweight, recovery entries, preferences, exercise choices and programme attempts. Repeated backup round trips and storage events from older clients cannot restore daily records. Missing or malformed retired fields are also discarded; validation of all remaining records stays in place. Corrupt non-retired data retains the existing error and raw-export recovery behaviour.

Bodyweight tests verify logging and reloading, replacing an entry for the same date, chart/history display, deletion, kg/lb conversion, nutrition references, version-4 export/import and offline operation. The bodyweight form, save logic, chart calculations and nutrition guidance were not changed.

## Regression flows

The full browser suite also checks all three navigation destinations, old links, settings return, one-tap workout entry and prefilled logging, inline errors/focus, selected exercise and running/paused rest recovery, rest expiry, exercise jumping, editing/cancellation, Undo, early/final finish, cool-down persistence, one-save confirmation and partial-session counting.

Programme checks cover active-workout naming, disabled starts for other sessions, immutable historical prescriptions, manual advance/repeat, Saturday availability at Weeks 4/5/6/9/16, optional core, assistance and timed/per-side logging. Model coverage retains source prescriptions, week boundaries, deload volume, progression gates and archived compatibility models. Archived models are not imported by the active app.

## Mobile review

Forty-four screenshots cover Today, bodyweight entry, Programme, Progress overview/history/bodyweight/recovery, Settings, logger, rest and review at 320×568, 390×844, 768×1000 and 1440×1000. They are saved in `artifacts/checkin-removal/`. Today, Recovery and bodyweight entry were visually inspected at both 320px and 390px.

Automated checks confirm no horizontal overflow, the main start action and weekly adherence above navigation at 320px, reachable logging actions, keyboard clearance at 320×330, enlarged text without page overflow and bodyweight sheet focus return. At 320×568, Log bodyweight remains reachable by scrolling below the primary workout card. The bodyweight save action fits within the sheet at both mobile sizes.

Existing contrast values remain unchanged: body text 15.15:1, secondary text 5.88:1 and primary button text 6.10:1. Validation uses Chromium and browser emulation; physical-device Safari/VoiceOver testing was not performed.

## Verified deployment package

- JavaScript: `assets/index-0RqUKJjA.js`
- Styles: `assets/index-BSa_z820.css`
- Service-worker SHA-256: `25ac8deb5564dfcf6cd3ae56bb88772d9f2f1e0990f71e93bba34728fc3ffc26`
- ZIP size: 155,874 bytes
- ZIP SHA-256: `fc539cac0129168af4081c17dabe9e0e68c1626a0628b44176662c18cc05ab2d`

Commands: `npm test`, `npm run build`, `npm run test:e2e`, `python3 scripts/package.py`.

The browser suite tested this production build before packaging. The archive contains deployment assets only, and the packaging script verified every archived file against `dist` byte for byte. Publishing is separate from this update.
