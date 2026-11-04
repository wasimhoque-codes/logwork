import { describe, expect, it } from 'vitest';
import { freshStore, newSession, selectedWorkout, reviewWeek, volume, exerciseKey, type Store } from '../src/model';
import { defaultMovement, movementSeries, recentMovements, trainingJourney } from '../src/progress-data';
import { changeLabel, movementValue, setLabel } from '../src/progress-charts';

function save(store: Store, date: string, day = 1, load = 20) {
  const session = newSession(selectedWorkout(store, day)!, store);
  session.date = date; session.startedAt = Date.parse(`${date}T10:00:00Z`); session.endedAt = session.startedAt + 60000;
  session.exercises.forEach((log, i) => log.sets.forEach(set => Object.assign(set, { done: true, weight: log.mode === 'bodyweight' ? 0 : load, reps: session.workout.exercises[i].max })));
  store.sessions.push(session); return session;
}
describe('training journey', () => {
  it('retains the beginning through restarts and includes empty Monday weeks through today', () => {
    let store = freshStore(); save(store, '2025-01-05');
    store.programme.week = 16; store.programme.attempts[0].week = 16;
    store = reviewWeek(reviewWeek(store, 'advance'), 'restart');
    save(store, '2026-11-02', 1); const result = trainingJourney(store, '2026-11-04');
    expect(result.firstDate).toBe('2025-01-05'); expect(result.sessions).toHaveLength(2);
    expect(result.weeks[0].date).toBe('2024-12-30'); expect(result.weeks.at(-1)?.date).toBe('2026-11-02');
    expect(result.weeks.length).toBeGreaterThan(90); expect(result.activeWeeks).toBe(2);
    expect(result.weeks[1]).toMatchObject({ sessions: 0, volume: 0 });
  });
  it('counts partials, optional sessions and extra logged sets, excluding empty saves and active workouts', () => {
    const store = freshStore(); const partial = save(store, '2026-10-25'); partial.exercises[0].sets[0].done = false;
    partial.exercises[0].sets.push({ weight: 30, reps: 8, done: true, rir: 3 });
    store.programme.week = 5; store.programme.attempts[0].week = 5; save(store, '2026-10-26', 6);
    const empty = save(store, '2026-10-27'); empty.exercises.forEach(log => log.sets.forEach(set => set.done = false));
    const active = save(store, '2026-10-28'); delete active.endedAt; store.active = active;
    const original = structuredClone(store), result = trainingJourney(store, '2026-10-28');
    expect(result.sessions).toHaveLength(2); expect(result.activeWeeks).toBe(2);
    expect(result.sets).toBe(result.sessions.reduce((n, s) => n + s.exercises.reduce((m, log) => m + log.sets.filter(set => set.done).length, 0), 0));
    expect(result.weeks.reduce((n, w) => n + w.volume, 0)).toBe(volume(partial) + volume(result.sessions[1]));
    expect(store).toEqual(original);
  });
  it.each(['2026-03-29', '2026-10-25'])('keeps UK DST weeks on Monday for %s', date => {
    const store = freshStore(); save(store, date); const result = trainingJourney(store, date);
    expect(new Date(result.weeks[0].date + 'T12:00:00Z').getUTCDay()).toBe(1); expect(result.weeks).toHaveLength(1);
  });
  it('has no invented baseline when empty', () => {
    expect(trainingJourney(freshStore())).toMatchObject({ sessions: [], series: [], sets: 0, activeWeeks: 0, weeks: [], firstDate: undefined });
  });
});
describe('shared movement series', () => {
  it('uses five appearances of each exact lift across interleaved workouts and attempts', () => {
    let store = freshStore();
    for (let i = 1; i <= 7; i++) { save(store, `2026-10-${String(i * 2).padStart(2, '0')}`, 1, i * 5); save(store, `2026-10-${String(i * 2 + 1).padStart(2, '0')}`, 2); if (i === 3) store = reviewWeek(store, 'repeat'); }
    const result = movementSeries(store.sessions).find(s => s.key === exerciseKey(store.sessions[0].workout.exercises[0]))!;
    expect(result.records).toHaveLength(7); expect(result.records.slice(-5).map(r => r.value)).toEqual([15, 20, 25, 30, 35]);
    expect(changeLabel(result, result.records.at(-5)!, result.records.at(-1)!, 'kg')).toBe('+20 kg load');
    const changed = save(store, '2026-10-20'); changed.workout.exercises[0].setup = 'New bench';
    expect(movementSeries(store.sessions).filter(s => s.exercise.id === result.exercise.id)).toHaveLength(2);
  });
  it('pairs reps with heaviest load, breaks ties by reps and ignores unlogged values', () => {
    const store = freshStore(), s = save(store, '2026-10-01'), log = s.exercises[0];
    log.sets[0] = { weight: 30, reps: 4, done: true, rir: null }; log.sets[1] = { weight: 30, reps: 6, done: true, rir: null };
    log.sets[2] = { weight: 90, reps: 20, done: false, rir: null };
    const record = movementSeries(store.sessions)[0].records[0];
    expect(record.best).toMatchObject({ weight: 30, reps: 6 }); expect(setLabel(record, 'kg')).toBe('30 kg × 6 reps');
    expect(movementValue(record, 'lb')).toBeCloseTo(66.13868, 4);
  });
  it('uses minimum assistance, maximum bodyweight reps and longest timed holds with load context', () => {
    const store = freshStore(), s = save(store, '2026-10-01', 4);
    s.exercises[0].sets[0].weight = 10; s.exercises[0].sets[0].reps = 4;
    s.exercises[0].sets[1].weight = 20; s.exercises[0].sets[1].reps = 8;
    const assisted = movementSeries(store.sessions).find(s => s.mode === 'assistance')!;
    expect(assisted.records[0].value).toBe(10); expect(setLabel(assisted.records[0], 'kg')).toBe('10 kg assist × 4 reps');
    const ex = s.workout.exercises[1], log = s.exercises[1]; ex.timed = true; log.mode = 'external';
    log.sets[0] = { weight: 20, reps: 40, done: true, rir: null }; log.sets[1] = { weight: 30, reps: 30, done: true, rir: null };
    const timed = movementSeries(store.sessions).find(item => item.exercise.id === ex.id)!;
    expect(timed.records[0].value).toBe(40); expect(setLabel(timed.records[0], 'lb')).toBe('44.09 lb × 40 sec');
    ex.timed = false; log.mode = 'bodyweight';
    expect(movementSeries(store.sessions).find(item => item.exercise.id === ex.id)!.records[0].value).toBe(40);
  });
  it('keeps zero loads and neutral flat changes, ordering full and sparse cards predictably', () => {
    const store = freshStore(); save(store, '2026-10-01', 1, 0); save(store, '2026-10-02', 1, 0); save(store, '2026-10-03', 2, 10);
    const series = movementSeries(store.sessions), selected = defaultMovement(series)!;
    expect(selected.exercise.role).toBe('main'); expect(selected.records).toHaveLength(2);
    expect(changeLabel(selected, selected.records[0], selected.records[1], 'kg')).toBe('0 kg load');
    expect(recentMovements(series)).toHaveLength(4); expect(recentMovements(series)[0].records.at(-1)!.session.date).toBe('2026-10-03');
    expect(recentMovements(series).every(s => s.exercise.role === 'main')).toBe(true);
    expect(recentMovements(series)[0].records.slice(-5)).toHaveLength(1);
  });
  it('does not merge mode, support height or core level differences', () => {
    const store = freshStore(); const a = save(store, '2026-10-01'); const b = save(store, '2026-10-02'); const c = save(store, '2026-10-03'); const d = save(store, '2026-10-04');
    b.exercises[0].mode = 'assistance'; c.workout.exercises[0].supportCm = 40; d.workout.exercises[0].coreLevel = 'hard';
    expect(movementSeries(store.sessions).filter(s => s.exercise.id === a.workout.exercises[0].id)).toHaveLength(4);
  });
});
