# Gym Hawk mobile redesign validation

Validated on 26 October 2026 against the final production build. Deployment was not performed.

| Check | Result |
| --- | --- |
| TypeScript and Vite production build | Passed |
| Model tests | 77 passed across 3 files |
| Production Playwright suite | 60 passed: 30 scenarios on desktop Chromium and iPhone-size Chromium emulation |
| Existing version-4 records and backup compatibility | Passed; no reset or schema version change |
| Running/paused timers and exercise position across reloads | Passed |
| Offline logging, immediate habit saving and backup restore | Passed |
| Service-worker upgrade retaining version-4 records | Passed |
| Production build and ZIP | All 10 files identical byte for byte |

## Flows checked

The suite exercises all three navigation destinations, old hash aliases, settings return, one-tap workout entry and prefilled-set logging, inline validation/focus, selected exercise and rest recovery, paused/rest expiry behaviour, exercise jumping, draft edits/cancellation, Undo, final-exercise completion, early finish, inline cool-down persistence, single-save confirmation and partial counting.

Programme checks cover an explicitly named active workout, disabled starts for other sessions, exercise choices that do not rewrite active/history snapshots, manual advance/repeat, Saturday availability at Weeks 4/5/6/9/16, optional knee-raise confirmation and dead-bug fallback, assistance and timed/per-side logging. Model tests retain all programme prescriptions and phase/volume/progression rules, as well as archived compatibility tests; old compatibility models are not imported into the active app.

Progress checks cover empty and populated overviews, history and editing, recorded-exercise prioritisation, the full catalogue toggle, explicit volume units, symptom-gated progression, bodyweight units and version-4 backup round trips. Check-ins save immediately, support clearing an answer to unknown, and report failed saves. Separate bodyweight entry preserves habit records. Existing version-4 sessions without resume metadata retain their records and open at the first unfinished exercise.

The first browser run exposed two issues: the logged-set list closing after an edit, and the workout return destination being lost after reload. Both were fixed and verified in the final 60-test production run. Final record-header alignment and 16px native-input styling are included in the tested package.

## Mobile and accessibility review

Forty screenshots cover Today, check-in, Programme, Progress overview/history/bodyweight, Settings, logger, rest and review at 320×568, 390×844, 768×1000 and 1440×1000. They are in `artifacts/mobile-redesign/`. Today/logger at 320px, Programme/Progress/logger/rest/review at 390px and the 320px check-in were inspected visually. The in-app browser was also used to inspect a pre-existing saved workout through the redesigned Progress and full-page record view and confirm its Back control.

Automated checks confirm no horizontal page overflow, start/weekly count above navigation at 320px, reachable logger actions, a focused input clear of the dock at 320×330, enlarged body/control text without page overflow, sheet focus return, keyboard validation focus and reduced-motion layouts. Native inputs use at least 16px text; secondary text is at least 14px. Interactive touch targets use at least 44×44px.

Core contrast ratios (WCAG relative luminance calculation):

- Body text: 15.15:1.
- Secondary text: 5.88:1.
- Primary button text: 6.10:1.

These checks use Chromium and browser emulation. Physical-device Safari/VoiceOver testing was not performed.

## Exact production package

- JavaScript: `assets/index-hnFXLXJP.js`
- Styles: `assets/index-CM5l7unb.css`
- Service-worker SHA-256: `7b059a3708d34859dc01aa7dc34850e31816172ec76cacea1a24e4c262bc502a`
- ZIP size: 157,040 bytes
- ZIP SHA-256: `8f14395e28e505df2703d94026d8f90d1dcbd5275647f24b247071595565e20d`

Commands: `npm test`, `npm run build`, `npm run test:e2e`, `python3 scripts/package.py`.

The archive contains only deployment assets. Source, tests, screenshots and documentation remain in the workspace. The final browser suite tested this build before packaging; the packaging script verified all archived files against `dist` byte for byte. Version-4 history, settings, programme attempts and choices remain intact when the deployed update loads.
