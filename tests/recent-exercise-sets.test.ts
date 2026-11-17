import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { exerciseKey, freshStore, newSession, recentExerciseSets, selectedWorkout, validateStore } from '../src/model';
import { activateStage, createStage, hash, mutate, readDataset, stageStore } from '../src/server/database';
import { changesBetween } from '../src/persistence/records';
import { TestDatabase } from './sqlite';

function savedStore() {
  const store = freshStore();
  const session = newSession(selectedWorkout(store, 2)!, store);
  session.date = '2026-10-01';
  session.endedAt = session.startedAt + 60_000;
  Object.assign(session.exercises[0].sets[0], { done: true, weight: 40, reps: 10 });
  store.sessions = [session];
  return store;
}

it('returns up to two matching logged sets across saved workouts', () => {
  const { sessions: [older] } = savedStore();
  const exercise = older.workout.exercises[0];
  const newer = structuredClone(older);
  newer.id = 'newer';
  newer.date = '2026-10-02';
  newer.exercises[0].sets[0].weight = 45;
  newer.exercises[0].sets.push({ done: true, weight: 50, reps: 8, rir: 2 });
  Object.assign(older.workout.exercises[0], { setup: 'Legacy machine' });
  expect(recentExerciseSets([], exercise)).toEqual([]);
  expect(recentExerciseSets([older], exercise)).toHaveLength(1);
  expect(recentExerciseSets([older, newer], exercise).map(row => [row.sessionId, row.setNumber])).toEqual([['newer', 3], ['newer', 1]]);
  newer.exercises[0].sets[0].done = false;
  expect(recentExerciseSets([older, newer], exercise).map(row => row.set.weight)).toEqual([50, 40]);
  expect(recentExerciseSets([older, newer], { ...exercise, supportCm: 40 })).toEqual([]);
  expect(recentExerciseSets([older, newer], { ...exercise, mode: 'assistance' })).toEqual([]);
});

it('removes retired fields on backup import and migrates stored prescriptions and receipt replays', async () => {
  const store = savedStore();
  const session = store.sessions[0];
  const choice = { variantId: session.workout.exercises[0].id, supportCm: null, coreLevel: 'Basic', setup: 'Legacy machine' };
  store.programme.options.choices['lower-a:squat'] = choice;
  Object.assign(session.workout.exercises[0], { setup: choice.setup });
  session.exercises[0].note = 'Keep this note';
  const clean = validateStore(store);
  expect(clean.programme.options.choices['lower-a:squat']).not.toHaveProperty('setup');
  expect(clean.sessions[0].workout.exercises[0]).not.toHaveProperty('setup');

  const db = new TestDatabase();
  try {
    const id = await createStage(db, null, 0);
    await stageStore(db, id, store);
    const before = await activateStage(db, id);
    const staged = await createStage(db, id, before.revision);
    await stageStore(db, staged, store);
    const pending = { datasetId: id, id: 'lost-response', editedAt: Date.now(), changes: changesBetween(clean, store) };

    db.raw.exec("ALTER TABLE exercise_choices ADD COLUMN setup TEXT NOT NULL DEFAULT 'Legacy machine'");
    db.raw.exec("UPDATE session_exercises SET identity_key=json_array(exercise_id,mode,'Legacy machine',json_extract(prescription,'$.supportCm'),json_extract(prescription,'$.coreLevel')), prescription=json_set(prescription,'$.setup','Legacy machine')");
    db.raw.prepare('INSERT INTO mutation_receipts VALUES(?,?,?,?)').run(id, pending.id, await hash(pending), before.revision);
    db.raw.exec(readFileSync('migrations/0003_remove_equipment_setup.sql', 'utf8'));

    expect(await readDataset(db, id)).toEqual(before);
    expect((await readDataset(db, staged)).store).toEqual(clean);
    expect(db.raw.prepare("SELECT identity_key FROM session_exercises WHERE position=0").all()).toEqual([
      { identity_key: exerciseKey(clean.sessions[0].workout.exercises[0]) },
      { identity_key: exerciseKey(clean.sessions[0].workout.exercises[0]) },
    ]);
    expect(await mutate(db, pending)).toEqual(before);
    const normalized = { ...pending, removedSetup: true as const, changes: pending.changes.map(change => ({ ...change, value: change.key === 'programme' ? clean.programme : clean.sessions[0] })) };
    expect(await mutate(db, normalized)).toEqual(before);
  } finally {
    db.close();
  }
});
