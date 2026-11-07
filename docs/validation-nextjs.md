# Next.js / D1 migration validation — 7 November 2026

The existing interface and programme rules were retained, including the uncommitted rest-day/recovery changes present before this migration.

## Results

- TypeScript: passed.
- Model, database, sync and authentication tests: **171 passed**.
- Desktop/mobile browser acceptance against the built Cloudflare Workers runtime: **154 passed, 14 intentionally skipped**. Skips avoid repeating the desktop screenshot matrix and the local D1 integration scenario in the mobile project.
- Loaded visual review at 320px, 390px, tablet and desktop: passed, including primary-action clearance, focus and reduced motion. The final screenshot helper explicitly waits for the loaded Next.js interface.
- Next.js 16.4.5 production build and OpenNext 1.20.16 Worker bundle: passed. The offline worker precaches 31 exact assets.
- Final pinned dependency audit: **0 vulnerabilities**.

The suite covers the current programme, logging, added sets, historical editing, exact exercise identities, charts, bodyweight replacement/deletion, feedback, retired-record compatibility and backup flows. New coverage exercises D1 constraints and atomic writes, duplicate/lost responses, stale revisions, deletion tombstones, competing active workouts, interrupted restores, restore-generation conflicts and verified Access tokens.

Real browser contexts exercised D1 synchronization, offline conflicts, explicit local-version selection, authentication expiry and recovery. IndexedDB quota failure tests verify that the last durable copy survives and unsaved changes remain available for export.

## Backup rehearsal

The supplied `gym-hawk-backup-2026-11-07.json` was imported privately into local D1. Administrative import, HTTP bootstrap/export and staged HTTP restore were exercised. The final exported store compared exactly with the validated source backup:

| Record | Count |
| --- | ---: |
| Programme attempts | 2 |
| Saved workouts | 8 |
| Exercise records | 56 |
| Sets | 114 |
| Logged sets | 113 |
| Extra sets | 22 |
| Bodyweight readings | 11 |
| Historical recovery records | 5 |

Repeated administrative import was confirmed to be a no-op. The original backup file was not modified, added to source, or bundled in public assets. The project's ignored local D1 state contains the verified backup; synthetic test history is excluded from that copy.

## Environment and deployment limits

Validation used Node.js 24.11.1 and native macOS ARM64 dependencies. The iCloud-backed checkout repeatedly dehydrated files during reads, so builds and browser checks ran from a local temporary copy. The application, migration, test, dependency-lock and build configuration files were compared byte-for-byte with the project copy.

Remote deployment and production import were not performed. Wrangler reported an expired login that could not refresh in the non-interactive session. Production and preview D1 IDs and Access owner settings also remain unset. Follow [the Cloudflare setup instructions](cloudflare.md); the deployment helper refuses incomplete configuration, and production API requests fail closed without owner authentication.

Physical iPhone Safari/VoiceOver testing and an authenticated production smoke test remain outside the completed local validation.
