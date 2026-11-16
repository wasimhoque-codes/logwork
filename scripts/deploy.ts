import { spawnSync } from 'node:child_process';
import { configuredPath } from './cloudflare-cli';

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const flags = args.filter(arg => arg !== '--preview' && arg !== '--check');
if (flags.some(arg => arg !== '--dry-run' && !/^--secrets-file=.+$/.test(arg))) {
  throw new Error('Use --secrets-file=/absolute/private/path or --dry-run.');
}
const config = configuredPath(preview, 'deploy');
if (args.includes('--check')) {
  console.log('Cloudflare deployment configuration is complete.');
  process.exit(0);
}

// This OpenNext app has no remote cache to populate. Invoke Wrangler directly
// so config and secret file paths are passed as arguments, including spaces.
const result = spawnSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', config, ...flags,
], { stdio: 'inherit', env: { ...process.env, OPEN_NEXT_DEPLOY: 'true' } });
process.exit(result.status ?? 1);
