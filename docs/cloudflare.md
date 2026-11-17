# Cloudflare Workers deployment

Gym Hawk uses Next.js 16 with `@opennextjs/cloudflare`, a D1 binding named `DB`, and GitHub sign-in for cloud sync. The production Worker is `logwork` and the preview Worker is `logwork-preview`. The app shell contains no personal data. Each data API request verifies a signed session for the single allowed GitHub account.

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

Authenticate Wrangler with `npx wrangler login`, or set `CLOUDFLARE_API_TOKEN` outside the repository. Use `npx wrangler d1 list` to verify the existing `logwork` and `logwork-preview` databases. Keep their IDs and the account ID from the existing deployment configuration. The two Workers must use different D1 databases.

Register two [GitHub OAuth apps](https://github.com/settings/developers), one per Worker. For each app, use the matching homepage and authorization callback URL.

| Worker | Homepage | Authorization callback |
| --- | --- | --- |
| Production | `https://logwork.wasimhoque16.workers.dev` | `https://logwork.wasimhoque16.workers.dev/api/auth/github/callback` |
| Preview | `https://logwork-preview.wasimhoque16.workers.dev` | `https://logwork-preview.wasimhoque16.workers.dev/api/auth/github/callback` |

Leave the device flow disabled. The owner is `wasimhoque-codes`, numeric GitHub ID `244625999`. You can verify the ID using the [GitHub account endpoint](https://api.github.com/users/wasimhoque-codes). Gym Hawk requests no repository or email scopes and uses the token only to verify the GitHub ID at sign-in. Version preview URLs stay disabled so sign-in uses the registered origin.

Update the ignored `cloudflare-deploy.local.json` with the GitHub client IDs and canonical origins. Replace the old Access entries with these fields.

```json
{
  "accountId": "your-cloudflare-account-id",
  "databaseId": "production-d1-id",
  "previewDatabaseId": "preview-d1-id",
  "githubOwnerId": "244625999",
  "githubClientId": "production-github-client-id",
  "previewGithubClientId": "preview-github-client-id",
  "appOrigin": "https://logwork.wasimhoque16.workers.dev",
  "previewAppOrigin": "https://logwork-preview.wasimhoque16.workers.dev"
}
```

Store `GITHUB_CLIENT_SECRET` and `SESSION_SECRET` as [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/) for each Worker. Generate a different session secret per Worker with `openssl rand -hex 32`. If setting secrets with the first deployment, create one private file per Worker outside the repository with permissions `0600`. Each file has the following keys.

```dotenv
GITHUB_CLIENT_SECRET=github-oauth-app-client-secret
SESSION_SECRET=independently-generated-random-value
```

Pass the file to the matching deployment as `--secrets-file=/absolute/private/path/to/secrets.env`. The next deployments can reuse the Worker secrets without the flag. Keep secrets, Wrangler credentials, and private backups outside source control and out of chat. Rotating the session secret invalidates existing sessions for that Worker.

## Preview and production rollout

Validate the preview database and sign-in before touching production. Reuse the preview binding, apply pending migrations, and use synthetic workouts when testing writes and cross-device sync.

```sh
npm run db:migrate:remote -- --preview
npm run deploy:preview -- --secrets-file=/absolute/private/path/preview-secrets.env
```

Check the uploaded bundle and runtime against the [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 Free limits](https://developers.cloudflare.com/d1/platform/pricing/). On preview, verify the app shell loads signed out, the APIs deny signed-out and wrong-account requests, and the owner can sign in, save a synthetic record, sign out, and sync queued offline edits after signing back in.

Inspect production D1 before deploying. Export a private backup of any existing records using the command below. Keep the existing dataset if it has records. If production is empty, apply pending migrations and import the previously selected v4 backup once.

```sh
npm run db:migrate:remote
npm run db:import -- /absolute/private/path/gym-hawk-backup.json --remote
```

Deploy production with its own OAuth credentials.

```sh
npm run deploy -- --secrets-file=/absolute/private/path/production-secrets.env
```

Deploy the GitHub-protected Worker before removing any legacy Access policy that covers its hostname. Remove only the policy or application for the Worker being cut over. Recheck signed-out API responses and complete the owner sign-in and second-device smoke test on the canonical URL.

For a local rehearsal use `npm run db:import -- /absolute/private/path/gym-hawk-backup.json --local` after local migrations. To replace an existing production dataset, use:

```sh
npm run db:import -- /absolute/private/path/new-backup.json --remote --replace --backup-current /absolute/private/path/pre-restore.json
```

The command verifies the private pre-restore export and checks the staged data against the input before activating. If the cloud dataset changes after export, activation stops. The previous dataset stays archived.


## Deploy on pushes to main

In Cloudflare, open **Workers & Pages → logwork → Settings → Builds → Connect**. Grant the Cloudflare GitHub App access to the `wasimhoque-codes/logwork` repository. Set the production branch to `main` and keep non-production branch builds disabled. The repository root is the project root.

| Setting | Value |
| --- | --- |
| Build variable | `NODE_VERSION=24` |
| Build command | `npm test` |
| Deploy command | `npm run deploy` |

Add an encrypted build variable named `GYM_HAWK_DEPLOY_CONFIG` with the production values for `accountId`, `databaseId`, `githubOwnerId`, `githubClientId` and `appOrigin` from the existing ignored `cloudflare-deploy.local.json`. The deploy command builds the OpenNext Worker and the offline assets. It deploys to the existing production Worker and reuses its `GITHUB_CLIENT_SECRET` and `SESSION_SECRET` runtime secrets. Cloudflare Workers Builds supplies its own deployment credential.

Commit the deployment configuration changes with the code you want to release. The next push to `main` starts a build. Check the result under **Settings → Builds** and confirm that the deployed Worker accepts GitHub sign-in. Apply any required D1 migrations separately before pushing code that depends on them.

## Sync and restore behavior

The app syncs after local edits, on opening or returning to the foreground, on reconnection, and every 30 seconds while visible. IndexedDB retains offline edits and the exact requests needed for retries. D1 compares edit times per record and uses edit IDs to break ties. Accurate device clocks matter. Deleted records keep their edit clocks. Completing a workout writes the saved workout and clears its matching draft together.

Signing in resumes the queue. Signing out leaves the local copy available. Auth routes and data APIs go to the network. Older cached app versions need to reload before writing.

An explicit version-4 restore activates a new dataset. Devices adopt it on their next sync. Unsynced work from the previous dataset is available through Download recovered backup in Settings. If records change during a manual restore, download the recovered copy and import it again if you still want to replace the cloud dataset.

## Release verification and rollback

Verify owner sign-in, rejection of unauthenticated API requests, imported counts, export parity, one workout save, offline reload/reconnect and sync between two devices. Never test production mutations with synthetic data; use the preview database.

Export a private version-4 backup before a release:

```sh
npm run db:export -- --remote --output /absolute/private/path/pre-release-backup.json
```

The UI export includes the current local working copy, including unsynced changes; `/api/backup` and the administrative export return the server snapshot. Keep both if investigating a sync issue. Do not commit either.

For an application regression, use Wrangler deployment rollback for the selected Worker. Restore the corresponding Access gate before rolling back to a Worker version that depends on Access. A code rollback does not roll back D1. For database recovery, use Cloudflare D1 Time Travel or restore a validated version-4 backup through the staged import flow. Review current local queues before restoring database history, since that history can have older revision numbers.

Inspect Worker errors and D1 metrics after deployment. The API logs error types rather than private record payloads. Missing GitHub configuration returns a service-unavailable response. Expired or invalid sessions return unauthorized on data requests, and the browser retains queued changes.
