import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { Database, Statement } from '../src/server/database';

export class TestDatabase implements Database {
  raw=new DatabaseSync(':memory:');
  constructor(){this.raw.exec(readFileSync('migrations/0001_training.sql','utf8'));}
  prepare(sql:string):Statement{return new TestStatement(this,sql,[]);}
  async batch<T>(statements:Statement[]):Promise<{results:T[]}[]> {
    this.raw.exec('BEGIN');
    try{const results=statements.map(s=>({results:(s as TestStatement).execute() as T[]}));this.raw.exec('COMMIT');return results;}
    catch(error){this.raw.exec('ROLLBACK');throw error;}
  }
  close(){this.raw.close();}
}
class TestStatement implements Statement {
  constructor(private db:TestDatabase,private sql:string,private params:unknown[]){}
  bind(...params:unknown[]):Statement{return new TestStatement(this.db,this.sql,params);}
  execute(){const stmt=this.db.raw.prepare(this.sql);return stmt.all(...this.params as (string|number|null)[]);}
  async all<T>(){return {results:this.execute() as T[]};}
  async first<T>(){return (await this.all<T>()).results[0]??null;}
  async run(){return this.all();}
}
