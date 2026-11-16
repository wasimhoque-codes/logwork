import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import type { Database, Statement, Sql } from '../src/server/database';

type DeploymentSettings = {
  accountId?: string;
  databaseId?: string;
  previewDatabaseId?: string;
  githubOwnerId?: string;
  githubClientId?: string;
  previewGithubClientId?: string;
  appOrigin?: string;
  previewAppOrigin?: string;
};

const databaseIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function isHttpsOrigin(value: string | undefined) {
  try { return !!value && value.startsWith('https://') && new URL(value).origin === value; }
  catch { return false; }
}

export function configuredPath(preview: boolean, mode: 'database' | 'deploy'): string {
  const local = resolve('cloudflare-deploy.local.json');
  if (!existsSync(local)) throw new Error('Create cloudflare-deploy.local.json using docs/cloudflare.md.');
  const settings = JSON.parse(readFileSync(local, 'utf8')) as DeploymentSettings;
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const selected = preview ? { ...config, ...config.env.preview } : config;
  delete selected.env;

  const databaseId = preview ? settings.previewDatabaseId : settings.databaseId;
  if (!databaseId || !databaseIdPattern.test(databaseId) || /^00000000-0000-0000-0000-000000000000$/.test(databaseId)) {
    throw new Error('A valid D1 database ID is required for the selected Worker.');
  }
  if (settings.previewDatabaseId && settings.previewDatabaseId.toLowerCase() === settings.databaseId?.toLowerCase()) {
    throw new Error('Preview and production must use different D1 databases.');
  }

  selected.main = resolve('.open-next/worker.js');
  selected.assets.directory = resolve('.open-next/assets');
  selected.d1_databases[0].migrations_dir = resolve('migrations');
  selected.d1_databases[0].database_id = databaseId;
  if (settings.accountId) selected.account_id = settings.accountId;
  if (mode === 'deploy') {
    const clientId = preview ? settings.previewGithubClientId : settings.githubClientId;
    const origin = preview ? settings.previewAppOrigin : settings.appOrigin;
    if (!clientId?.trim() || !isHttpsOrigin(origin) || typeof settings.githubOwnerId !== 'string' ||
        !/^[1-9]\d*$/.test(settings.githubOwnerId)) {
      throw new Error('The Worker needs its GitHub client ID, canonical HTTPS origin, and numeric owner ID.');
    }
    if (settings.githubClientId === settings.previewGithubClientId || settings.appOrigin === settings.previewAppOrigin) {
      throw new Error('Preview and production must use separate OAuth apps and origins.');
    }
    selected.vars = { APP_ORIGIN: origin, GITHUB_CLIENT_ID: clientId, GITHUB_OWNER_ID: settings.githubOwnerId };
    selected.secrets = { required: ['GITHUB_CLIENT_SECRET', 'SESSION_SECRET'] };
  }

  const dir = resolve('.wrangler/generated');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, (preview ? 'preview' : 'production') + (mode === 'database' ? '-db' : '') + '.json');
  writeFileSync(path, JSON.stringify(selected, null, 2), { mode: 0o600 });
  return path;
}
const literal=(value:unknown):string=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
export function renderSql(statement:Sql) {let i=0;const sql=statement.sql.replace(/\?/g,()=>literal(statement.params[i++]));if(i!==statement.params.length)throw new Error('SQL parameter count mismatch.');return sql;}
export class CliDatabase implements Database {
  private authorization?: Record<string, string>;

  constructor(private remote:boolean,private preview=false){}
  async batch<T>(statements:Statement[]):Promise<{results:T[]}[]> {
    const queries = statements.map(statement => (statement as CliStatement).query);
    if (this.remote) return this.queryRemote<T>(queries);

    const sql=queries.map(renderSql).join(';\n')+';\n';
    const dir=mkdtempSync(join(tmpdir(),'gym-hawk-d1-'));
    try {
      const file=join(dir,'query.sql');writeFileSync(file,sql,{mode:0o600});
      const args=['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config',resolve('wrangler.jsonc'),'--file',file,'--json'];
      if(this.preview)args.push('--env','preview');
      const result=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:64*1024*1024});
      if(result.status!==0)throw new Error('D1 command failed. '+(result.stderr||'Check Wrangler configuration.'));
      return JSON.parse(result.stdout) as {results:T[]}[];
    }finally{rmSync(dir,{recursive:true,force:true});}
  }
  private async queryRemote<T>(batch: Sql[]): Promise<{ results: T[] }[]> {
    const config = JSON.parse(readFileSync(configuredPath(this.preview, 'database'), 'utf8'));
    if (!/^[a-f0-9]{32}$/i.test(config.account_id ?? '')) {
      throw new Error('Set the Cloudflare account ID in cloudflare-deploy.local.json.');
    }
    if (!this.authorization) {
      const credentials = spawnSync(process.execPath, [
        'node_modules/wrangler/bin/wrangler.js', 'auth', 'token', '--json',
      ], { encoding: 'utf8', env: { ...process.env, WRANGLER_WRITE_LOGS: 'false' } });
      if (credentials.status !== 0) throw new Error('Authenticate with Wrangler before using remote D1.');
      const auth = JSON.parse(credentials.stdout);
      if (auth.token) this.authorization = { Authorization: 'Bearer ' + auth.token };
      else if (auth.key && auth.email) this.authorization = { 'X-Auth-Key': auth.key, 'X-Auth-Email': auth.email };
      else throw new Error('Wrangler did not return Cloudflare credentials.');
    }

    // Wrangler's remote --file mode imports SQL and returns statistics, not query rows.
    const url = `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/d1/database/${config.d1_databases[0].database_id}/query`;
    const response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { ...this.authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch }),
    });
    const value = await response.json() as {
      success: boolean;
      errors?: { code: number }[];
      result?: { success: boolean; results: T[] }[];
    };
    if (!response.ok || !value.success || value.result?.length !== batch.length ||
        value.result.some(entry => !entry.success || !Array.isArray(entry.results))) {
      const codes = value.errors?.map(error => error.code).join(', ');
      throw new Error(`D1 query failed (HTTP ${response.status}${codes ? ', Cloudflare ' + codes : ''}).`);
    }
    return value.result;
  }

  prepare(sql:string):Statement {return new CliStatement(this,{sql,params:[]});}
}
class CliStatement implements Statement {
  constructor(private db:CliDatabase,public query:Sql){}
  bind(...params:unknown[]):Statement{return new CliStatement(this.db,{sql:this.query.sql,params:params as Sql['params']});}
  async all<T>():Promise<{results:T[]}>{return (await this.db.batch<T>([this]))[0];}
  async first<T>():Promise<T|null>{return (await this.all<T>()).results[0]??null;}
  async run():Promise<unknown>{return this.all();}
}
