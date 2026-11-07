# Cloudflare Workers deployment

Gym Hawk uses Next.js 16 with `@opennextjs/cloudflare`, a D1 binding named `DB`, and Cloudflare Access. The production Worker is `logwork`; the separate preview Worker is `logwork-preview`. The app shell contains no personal data. Every API request independently verifies the Access JWT and exact owner email.

## Local development and validation

Use Node.js 24. On this Mac use `npm ci --os=darwin --cpu=arm64` (the host npm configuration may otherwise choose Linux binaries). In Linux CI use `npm ci`.

```sh
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

`LOCAL_DEV_AUTH=1` works only on HTTP loopback URLs. Never configure it on a deployed Worker. Local D1 state is ignored under `.wrangler/`; it is separate from the remote database. A first browser visit migrates existing version-4 browser records into IndexedDB. Neither an empty server response nor a failed sign-in clears local records.

```sh
npm test
npm run typecheck
npm run build:worker
npm run preview
```

Preview runs the built app in `workerd`, rather than treating a Node development server as deployment validation. Set `PW_BASE_URL` to its URL to run `npm run test:e2e`. Browser behavior tests isolate remote synchronization with mocked API responses; the sync-specific tests exercise the real persistence and revision logic.

## Configure your account

Authenticate Wrangler with `npx wrangler login`, or supply `CLOUDFLARE_API_TOKEN` outside the repository. Create two databases:

```sh
npx wrangler d1 create logwork
npx wrangler d1 create logwork-preview
```

Create an Access self-hosted application for `logwork.wasimhoque16.workers.dev`, using email one-time PIN or your existing identity provider, with an Allow policy for your exact email. Protect the preview Worker separately. Keep version preview URLs disabled, as configured, unless Access also covers them. Access must cover the entire hostname, including assets and `/api/*`. Do not add a public bypass.

Create the ignored file `cloudflare-deploy.local.json`:

```json
{
  "accountId": "your-cloudflare-account-id",
  "databaseId": "production-d1-id",
  "previewDatabaseId": "preview-d1-id",
  "accessTeamDomain": "your-team.cloudflareaccess.com",
  "accessAudience": "production-access-application-audience",
  "previewAccessAudience": "preview-access-application-audience",
  "ownerEmail": "your-exact-email@example.com"
}
```

The deploy helper generates an ignored Wrangler configuration with the selected database and owner settings. It refuses missing values. Account tokens and backup files are not placed in this file or the source tree.

## Migrate and import privately

Always migrate before importing. Validate the preview database first:

```sh
npm run db:migrate:remote -- --preview
npm run db:import -- /absolute/private/path/gym-hawk-backup.json --remote --env preview
npm run deploy:preview
```

After preview verification, repeat with production:

```sh
npm run db:migrate:remote
npm run db:import -- /absolute/private/path/gym-hawk-backup.json --remote
npm run deploy
```

For a local rehearsal use `npm run db:import -- /absolute/private/path/gym-hawk-backup.json --local` after local migrations. The administrative import validates the full backup, retains IDs/order/snapshots/nulls/incomplete sets, stages it, activates atomically and verifies a canonical version-4 round-trip. Repeating the same backup is a no-op. It refuses a database that already has personal records; use the app’s reviewed Restore flow to replace those. The source file is read from its original private location. Temporary SQL files use private permissions and are deleted after each command.

The supplied 2026-11-07 backup should produce 2 attempts, 8 saved workouts, 56 exercise records, 114 sets (113 logged, 22 extras), 11 weigh-ins and 5 preserved historical recovery entries. Historical recovery is retained for export without reintroducing retired activity tracking.

## Sync and restore behavior

The working copy and queue are durable in IndexedDB. Requests carry a mutation ID and expected revisions; D1 guards and batch transactions prevent partial writes, duplicates and lost updates. Tombstones prevent stale devices from recreating deleted readings. The active workout is a separate singleton sync record; finishing it and inserting the saved workout happen together.

Different records merge. Conflicts retain local and cloud versions until the owner chooses. A pending conflict never silently becomes last-write-wins. Signing in again resumes pending changes. The cached offline shell contains no database response, login page or token; local workout access remains available on a previously used device.

Manual version-4 restore remains available offline. It retains a fixed restore target, uploads bounded chunks into a new dataset and validates the assembled result before activation. A database revision change during upload requires review. Old datasets remain archived; an interrupted stage never becomes current. Avoid clearing browser storage while unsynced records or conflicts remain.

## Release verification and rollback

Verify owner sign-in, rejection of unauthenticated API requests, imported counts, export parity, one workout save, offline reload/reconnect and sync between two devices. Never test production mutations with synthetic data; use the preview database.

Export a private version-4 backup before a release:

```sh
npm run db:export -- --remote --output /absolute/private/path/pre-release-backup.json
```

The UI export includes the current local working copy, including unsynced changes; `/api/backup` and the administrative export return the server snapshot. Keep both if investigating a sync issue. Do not commit either.

For an application regression, use Wrangler deployment rollback for the selected Worker. A code rollback does not roll back D1. This migration is additive; retain old tables and archived datasets through the rollout. For database recovery, use Cloudflare D1 Time Travel or restore a validated version-4 backup through the staged import flow. Review current local queues before restoring database history, since that history can have older revision numbers.

Inspect Worker errors and D1 metrics after deployment. The API logs error types rather than private record payloads. Missing Access configuration returns a service-unavailable response; expired or invalid sign-in returns unauthorized, and the browser retains queued changes.
