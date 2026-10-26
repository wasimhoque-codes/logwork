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
