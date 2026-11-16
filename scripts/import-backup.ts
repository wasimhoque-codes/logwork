import { readFileSync, writeFileSync } from 'node:fs';
import { validateStore } from '../src/model';
import { createStage, stageChunk, activateStage, snapshot, readDataset, hash } from '../src/server/database';
import { importRecords } from '../src/persistence/records';
import { CliDatabase } from './cloudflare-cli';

const [file, ...args] = process.argv.slice(2);
const local = args.includes('--local');
const remote = args.includes('--remote');
const replace = args.includes('--replace');
const backupIndex = args.indexOf('--backup-current');
const backupPath = backupIndex < 0 ? undefined : args[backupIndex + 1];
if (!file || file.startsWith('--') || local === remote || replace && (!backupPath || backupPath.startsWith('--'))) {
  throw new Error('Usage: npm run db:import -- /private/input.json --local|--remote [--env preview] [--replace --backup-current /private/prior.json]');
}
const store = validateStore(JSON.parse(readFileSync(file, 'utf8')));
const digest = await hash(store);
const db = new CliDatabase(remote, args.includes('preview'));
const current = await snapshot(db);

if (current.store) {
  if (!replace) {
    if (await hash(current.store) === digest) {
      console.log('The current dataset already matches this backup.');
      process.exit(0);
    }
    if (current.store.active || current.store.sessions.length || current.store.body.length || current.store.recovery.length ||
      current.store.settings.name || current.store.programme.attempts.length > 1 || current.store.programme.week !== 1) {
      throw new Error('Database contains records. Use --replace with a private path for the current backup.');
    }
  } else {
    const original = validateStore(current.store);
    writeFileSync(backupPath!, JSON.stringify(original, null, 2) + '\n', {mode:0o600, flag:'wx', flush:true});
    if (await hash(validateStore(JSON.parse(readFileSync(backupPath!, 'utf8')))) !== await hash(original)) {
      throw new Error('The pre-restore backup could not be verified.');
    }
    console.log('Verified the private pre-restore backup at ' + backupPath);
  }
}

const id = await createStage(db, current.datasetId, current.revision);
const changes = importRecords(store);
for (let cursor = 0; cursor < changes.length; cursor += 5) {
  await stageChunk(db, id, store, changes.slice(cursor, cursor + 5));
}
if (await hash((await readDataset(db, id)).store) !== digest) {
  throw new Error('The staged dataset does not match the supplied backup. Current records were retained.');
}
const activated = await activateStage(db, id);
if (activated.datasetId !== id || !activated.store || await hash(activated.store) !== digest) {
  throw new Error('Could not verify the activated dataset. Keep both backup files.');
}
const restored = activated.store;
console.log(JSON.stringify({
  imported:true, workouts:restored.sessions.length, attempts:restored.programme.attempts.length,
  sets:restored.sessions.reduce((n,s)=>n+s.exercises.reduce((count,e)=>count+e.sets.length,0),0),
  bodyweight:restored.body.length, historicalRecovery:restored.recovery.length, active:!!restored.active,
}));
