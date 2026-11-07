import { spawnSync } from 'node:child_process';
import { configuredPath } from './cloudflare-cli';
import { resolve } from 'node:path';
const remote=process.argv.includes('--remote'),preview=process.argv.includes('--preview');
const config=remote?configuredPath(preview,true):resolve('wrangler.jsonc');
const args=['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB',remote?'--remote':'--local','--config',config];
if(config.endsWith('wrangler.jsonc')&&preview)args.push('--env','preview');
const result=spawnSync(process.execPath,args,{stdio:'inherit'});process.exit(result.status??1);
