import { describe, expect, it } from 'vitest';
import { freshStore, selectedWorkout, newSession, exerciseKey, type Store } from '../src/model';
import { featuredMovements, movementComparison, movementSeries } from '../src/progress-data';

function save(store: Store, date: string, load = 20, reps = 8) {
  const session = newSession(selectedWorkout(store, 1)!, store);
  session.date = date;
  session.startedAt = Date.parse(date + 'T10:00:00Z');
  session.endedAt = session.startedAt + 3600000;
  session.exercises.forEach(log => log.sets.forEach(set => Object.assign(set, { weight: load, reps, done: true })));
  store.sessions.push(session);
  return session;
}
function firstSeries(store: Store) {
  const session = store.sessions.at(-1)!;
  return movementSeries(store.sessions).find(series => series.key === exerciseKey(session.workout.exercises[0], session.exercises[0].mode))!;
}

describe('strength overview', () => {
  it('selects up to four identities, main lifts first, using training date rather than entry time', () => {
    const store = freshStore();
    const backdated = save(store, '2026-11-01');
    backdated.startedAt = Date.parse('2026-11-20T12:00:00Z');
    const recent = save(store, '2026-11-19');
    recent.workout.exercises[0].supportCm = 40;
    const original = structuredClone(store);
    const selected = featuredMovements(movementSeries(store.sessions));
    expect(selected).toHaveLength(4);
    expect(selected[0].exercise.role).toBe('main');
    expect(selected[0].records.at(-1)!.session.date).toBe('2026-11-19');
    expect(new Set(selected.map(series => series.key)).size).toBe(4);
    expect(store).toEqual(original);
    expect(featuredMovements([])).toEqual([]);
  });
  it('does not invent a comparison from a single date or two workouts on the same date', () => {
    const store = freshStore();
    save(store, '2026-11-20'); save(store, '2026-11-20', 20, 10);
    expect(movementComparison(firstSeries(store))).toMatchObject({ previous:undefined, comparable:undefined, delta:undefined, direction:'neutral' });
  });
  it('compares against the best same-load set on the nearest earlier matching date, including extra sets', () => {
    const store = freshStore();
    save(store, '2026-11-01', 20, 14);
    const previous = save(store, '2026-11-10', 25, 8);
    previous.exercises[0].sets.push({ weight:20, reps:9, done:true, rir:2 });
    save(store, '2026-11-19', 20, 11);
    const comparison = movementComparison(firstSeries(store));
    expect(comparison.comparable?.session.date).toBe('2026-11-10');
    expect(comparison.comparable?.best.reps).toBe(9);
    expect(comparison).toMatchObject({ delta:2, direction:'up' });
  });
  it('keeps a heavier load with fewer reps neutral when it has no same-load baseline', () => {
    const store = freshStore(); save(store, '2026-11-01', 20, 12); save(store, '2026-11-19', 25, 6);
    expect(movementComparison(firstSeries(store))).toMatchObject({ delta:undefined, direction:'neutral' });
  });
  it.each(['assistance', 'bodyweight'] as const)('compares %s reps without mixing modes or support heights', mode => {
    const store = freshStore();
    const before = save(store, '2026-11-01', 20, 8);
    const after = save(store, '2026-11-19', mode === 'bodyweight' ? 0 : 20, 10);
    before.exercises[0].mode = mode; after.exercises[0].mode = mode;
    expect(movementComparison(firstSeries(store))).toMatchObject({ delta:2, direction:'up' });
    after.workout.exercises[0].supportCm = 40;
    expect(movementComparison(firstSeries(store)).previous).toBeUndefined();
  });
  it('does not reward a longer timed hold at a different external load', () => {
    const store = freshStore(); const before = save(store, '2026-11-01', 20, 30); const after = save(store, '2026-11-19', 10, 45);
    before.workout.exercises[0].timed = true; after.workout.exercises[0].timed = true;
    expect(movementComparison(firstSeries(store))).toMatchObject({ delta:undefined, direction:'neutral' });
  });
  it('highlights less assistance only when reps are maintained', () => {
    const store = freshStore(); const before = save(store, '2026-11-01', 20, 8); const after = save(store, '2026-11-19', 15, 8);
    before.exercises[0].mode = 'assistance'; after.exercises[0].mode = 'assistance';
    expect(movementComparison(firstSeries(store))).toMatchObject({ assistanceReduction:5, direction:'up' });
    after.exercises[0].sets.forEach(set => { set.reps = 6; });
    expect(movementComparison(firstSeries(store))).toMatchObject({ assistanceReduction:undefined, direction:'neutral' });
  });
  it('excludes unfinished workouts and unchecked heavy sets from the overview', () => {
    const store = freshStore(); const first = save(store, '2026-11-01', 20, 8);
    first.exercises[0].sets.push({ weight:100, reps:20, done:false, rir:null });
    const unfinished = save(store, '2026-11-19', 50, 6); delete unfinished.endedAt;
    const series = firstSeries({...store, sessions:[first]});
    expect(movementComparison(series).latest.best.weight).toBe(20);
    expect(featuredMovements(movementSeries(store.sessions)).every(series => series.records.at(-1)!.session.date === '2026-11-01')).toBe(true);
  });
});
