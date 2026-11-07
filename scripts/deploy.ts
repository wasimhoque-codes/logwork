import { spawnSync } from 'node:child_process';
import { configuredPath } from './cloudflare-cli';
const preview=process.argv.includes('--preview'),check=process.argv.includes('--check');
const config=configuredPath(preview,true);
if(check){console.log('Cloudflare deployment configuration is complete.');process.exit(0);}
const result=spawnSync(process.execPath,['node_modules/@opennextjs/cloudflare/dist/cli/index.js','deploy','--config',config],{stdio:'inherit'});
process.exit(result.status??1);
