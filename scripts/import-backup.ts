import { readFileSync } from 'node:fs';
import { validateStore } from '../src/model';
import { createStage, stageStore, activateStage, snapshot, hash } from '../src/server/database';
import { CliDatabase } from './cloudflare-cli';

const args=process.argv.slice(2), file=args.find(a=>!a.startsWith('--')&&a!=='preview');
if(!file)throw new Error('Usage: npm run db:import -- /absolute/path/backup.json --local|--remote [--env preview]');
if(!args.includes('--local')&&!args.includes('--remote'))throw new Error('Choose --local or --remote explicitly.');
const store=validateStore(JSON.parse(readFileSync(file,'utf8'))), digest=await hash(store);
const db=new CliDatabase(args.includes('--remote'),args.includes('preview'));
const prior=await db.prepare('SELECT id FROM datasets WHERE import_hash=?').bind(digest).first();
if(prior){console.log('This backup was already imported. No records were changed.');process.exit(0);}
const current=await snapshot(db);
if(current.store&&(current.store.active||current.store.sessions.length||current.store.body.length||current.store.recovery.length||current.store.settings.name||current.store.programme.attempts.length>1||current.store.programme.week!==1))throw new Error('Database already contains records. Use the app’s reviewed Restore flow to replace them.');
const id=await createStage(db,current.datasetId,current.revision);
await stageStore(db,id,store);
await db.prepare('UPDATE datasets SET import_hash=? WHERE id=?').bind(digest,id).run();
await activateStage(db,id,process.env.OWNER_EMAIL??'owner');
const restored=(await snapshot(db)).store!;
if(await hash(restored)!==digest)throw new Error('Round-trip verification failed. Keep the original backup.');
console.log(JSON.stringify({imported:true,workouts:restored.sessions.length,attempts:restored.programme.attempts.length,exerciseRecords:restored.sessions.reduce((n,s)=>n+s.exercises.length,0),sets:restored.sessions.reduce((n,s)=>n+s.exercises.reduce((n,e)=>n+e.sets.length,0),0),bodyweight:restored.body.length,historicalRecovery:restored.recovery.length}));
