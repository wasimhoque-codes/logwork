import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import type { Database, Statement, Sql } from '../src/server/database';

export type DeploymentSettings={accountId?:string;databaseId:string;previewDatabaseId?:string;accessTeamDomain:string;accessAudience:string;ownerEmail:string;previewAccessAudience?:string};
export function configuredPath(preview=false,required=false):string {
  const local=resolve('cloudflare-deploy.local.json');
  if(!existsSync(local)){if(required)throw new Error('Create cloudflare-deploy.local.json using docs/cloudflare.md before deployment.');return resolve('wrangler.jsonc');}
  const settings=JSON.parse(readFileSync(local,'utf8')) as DeploymentSettings;
  const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
  const selected=preview?{...config,...config.env.preview}:config;delete selected.env;
  selected.main=resolve('.open-next/worker.js');selected.assets.directory=resolve('.open-next/assets');
  selected.d1_databases[0].migrations_dir=resolve('migrations');
  selected.d1_databases[0].database_id=preview?settings.previewDatabaseId:settings.databaseId;
  if(settings.accountId)selected.account_id=settings.accountId;
  selected.vars={ACCESS_TEAM_DOMAIN:settings.accessTeamDomain,ACCESS_AUDIENCE:preview?settings.previewAccessAudience:settings.accessAudience,OWNER_EMAIL:settings.ownerEmail};
  if(required&&(!selected.d1_databases[0].database_id||selected.d1_databases[0].database_id.startsWith('00000000')||Object.values(selected.vars).some(v=>!v)))throw new Error('Database ID and Access owner configuration are required. Preview needs its own database and Access audience.');
  const dir=resolve('.wrangler/generated');mkdirSync(dir,{recursive:true});const path=join(dir,preview?'preview.json':'production.json');
  writeFileSync(path,JSON.stringify(selected,null,2),{mode:0o600});return path;
}
const literal=(value:unknown):string=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
export function renderSql(statement:Sql) {let i=0;const sql=statement.sql.replace(/\?/g,()=>literal(statement.params[i++]));if(i!==statement.params.length)throw new Error('SQL parameter count mismatch.');return sql;}
export class CliDatabase implements Database {
  constructor(private remote:boolean,private preview=false){}
  async batch<T>(statements:Statement[]):Promise<{results:T[]}[]> {
    const sql=statements.map(s=>(s as CliStatement).query).map(renderSql).join(';\n')+';\n';
    const dir=mkdtempSync(join(tmpdir(),'gym-hawk-d1-'));
    try {
      const file=join(dir,'query.sql');writeFileSync(file,sql,{mode:0o600});
      const config=this.remote?configuredPath(this.preview,true):resolve('wrangler.jsonc');
      const args=['node_modules/wrangler/bin/wrangler.js','d1','execute','DB',this.remote?'--remote':'--local','--config',config,'--file',file,'--json'];
      if(config.endsWith('wrangler.jsonc')&&this.preview)args.push('--env','preview');
      const result=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:64*1024*1024});
      if(result.status!==0)throw new Error('D1 command failed. '+(result.stderr||'Check Wrangler configuration.'));
      return JSON.parse(result.stdout) as {results:T[]}[];
    }finally{rmSync(dir,{recursive:true,force:true});}
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
