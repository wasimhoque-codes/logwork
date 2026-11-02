import { describe, expect, it } from 'vitest';
import { freshStore, selectedWorkout, newSession, reviewWeek, currentAttempt, volume, fromKg, type Store, type Session } from '../src/model';
import { attemptSummary, bodySnapshot, calendarDay, recoverySnapshot, strengthSpotlight, volumeDistribution } from '../src/progress-data';

function fixture(week = 5) {
  const store = freshStore(); store.programme.week = week; store.programme.attempts[0].week = week;
  return store;
}
let sequence = 0;
function save(store: Store, day = 1, load = 20): Session {
  const session = newSession(selectedWorkout(store, day)!, store);
  session.startedAt = ++sequence * 100000; session.endedAt = session.startedAt + 60000;
  session.exercises.forEach((log, i) => log.sets.forEach(set => Object.assign(set, { done: true, weight: log.mode === 'bodyweight' ? 0 : load, reps: session.workout.exercises[i].max, rir: 3 })));
  store.sessions.push(session); return session;
}
function repeat(store: Store) { return reviewWeek(store, 'repeat'); }

describe('attempt summary', () => {
  it('starts at one, counts consecutive repeats and resets after advancement', () => {
    let store = fixture(); expect(attemptSummary(store).number).toBe(1);
    store = repeat(repeat(store)); expect(attemptSummary(store).number).toBe(3);
    expect(attemptSummary(store).previous?.id).toBe(store.programme.attempts.at(-2)!.id);
    store = reviewWeek(store, 'advance'); expect(attemptSummary(store).number).toBe(1);
    expect(attemptSummary(store).previous).toBeUndefined();
  });
  it('starts at one after a completed block restarts, including later repeats of week one', () => {
    let store = fixture(16); store = reviewWeek(store, 'advance'); store = reviewWeek(store, 'restart');
    expect(attemptSummary(store).number).toBe(1); expect(attemptSummary(repeat(store)).number).toBe(2);
  });
  it('deduplicates completed main workouts, marks partials, and excludes active and optional workouts', () => {
    const store = fixture(); save(store); save(store); const partial = save(store, 2);
    partial.exercises[0].sets[0].done = false; save(store, 6);
    store.active = newSession(selectedWorkout(store, 4)!, store);
    const summary = attemptSummary(store);
    expect(summary.complete).toBe(1); expect(summary.workouts.map(w => w.status)).toEqual(['complete', 'partial', 'pending', 'pending']);
  });
  it('isolates attempt recovery, counts unique days and retains a completed attempt', () => {
    let store = fixture(); const old = currentAttempt(store).id; store = repeat(store);
    store.recovery = [old, currentAttempt(store).id, currentAttempt(store).id].map((attemptId, i) => ({ id: String(i), attemptId, week: 5, date: '2026-11-01', cardio: 25, mobility: 10, activity: 'walking', note: '' }));
    expect(attemptSummary(store)).toMatchObject({ recoveryDays: 1, cardio: 50 });
    store.programme.status = 'complete'; expect(attemptSummary(store).attempt.id).toBe(currentAttempt(store).id);
  });
});

describe('strength spotlight', () => {
  it('has no invented results before a saved workout in the current attempt', () => {
    const store = fixture(); save(store); expect(strengthSpotlight(repeat(store)).cards).toEqual([]);
  });
  it('compares a repeat with the immediately preceding attempt rather than a newer same-attempt workout', () => {
    let store = fixture(); const baseline = save(store, 1, 15); store = repeat(store);
    save(store, 1, 18); const latest = save(store, 1, 20);
    const result = strengthSpotlight(store);
    expect(result.session?.id).toBe(latest.id); expect(result.baseline?.id).toBe(baseline.id);
    expect(result.cards[0]).toMatchObject({ previousBest: { weight: 15 }, best: { weight: 20 }, loadPR: true });
  });
  it('does not skip an empty previous attempt to find a misleading repeat baseline', () => {
    let store = fixture(); save(store); store = repeat(repeat(store)); save(store, 1, 25);
    expect(strengthSpotlight(store).baseline).toBeUndefined(); expect(strengthSpotlight(store).cards[0].previousBest).toBeUndefined();
  });
  it('uses the previous matching workout on ordinary weeks and ignores later workouts', () => {
    const store = fixture(); const first = save(store); save(store, 2); const latest = save(store, 1, 22);
    expect(strengthSpotlight(store).baseline?.id).toBe(first.id);
    const future = structuredClone(latest); future.id = 'future'; future.attemptId = 'other'; future.startedAt += 100000; future.exercises[0].sets.forEach(s => s.weight = 99); store.sessions.push(future);
    expect(strengthSpotlight(store).cards[0].loadPR).toBe(true);
  });
  it('matches exact setup identities and does not treat the first recorded load as a PR', () => {
    const store = fixture(); save(store, 1, 15); const latest = save(store, 1, 20);
    latest.workout.exercises[0].setup = 'Different bench';
    expect(strengthSpotlight(store).cards[0]).toMatchObject({ previousBest: undefined, loadPR: false });
  });
  it('does not label a gain against baseline as an all-time load record', () => {
    let store = fixture(); save(store, 1, 30); store = repeat(store); save(store, 1, 15); store = repeat(store); save(store, 1, 20);
    expect(strengthSpotlight(store).cards[0]).toMatchObject({ previousBest: { weight: 15 }, loadPR: false });
  });
  it('keeps reps paired with the heaviest logged set, with reps breaking load ties', () => {
    const store = fixture(); const session = save(store); const sets = session.exercises[0].sets;
    sets[0].weight = 25; sets[0].reps = 5; sets[1].weight = 20; sets[1].reps = 15; sets[2].weight = 25; sets[2].reps = 7;
    sets.push({ weight: 90, reps: 1, done: false, rir: null });
    expect(strengthSpotlight(store).cards[0].best).toMatchObject({ weight: 25, reps: 7 });
  });
  it('selects two main, one accessory and one core card, backfilling sparse partials', () => {
    const store = fixture(); const session = save(store);
    expect(strengthSpotlight(store).cards.map(c => c.exercise.role)).toEqual(['main', 'main', 'accessory', 'core']);
    session.exercises.slice(0, 3).forEach(log => log.sets.forEach(s => s.done = false));
    expect(strengthSpotlight(store).cards).toHaveLength(4);
    expect(strengthSpotlight(store).cards.every(c => c.sets > 0)).toBe(true);
  });
  it('includes extras in volume and set counts and suppresses zero-baseline percentages', () => {
    const store = fixture(); const old = save(store, 1, 0), latest = save(store, 1, 20);
    latest.exercises[0].sets.push({ weight: 10, reps: 5, done: true, rir: 3 });
    const card = strengthSpotlight(store).cards[0];
    expect(card.sets).toBe(4); expect(card.previousSets).toBe(old.exercises[0].sets.length);
    expect(card.volume).toBe(20 * 12 * 3 + 50); expect(card.volumeChange).toBeNull();
  });
  it('uses least assistance, max bodyweight reps and seconds without assigning load PRs', () => {
    const store = fixture(); const session = save(store, 4);
    session.exercises[0].sets[0].weight = 15; session.exercises[0].sets[0].reps = 5;
    session.exercises[0].sets[1].weight = 20; session.exercises[0].sets[1].reps = 8;
    const result = strengthSpotlight(store);
    expect(result.cards[0].best).toMatchObject({ weight: 15, reps: 5 }); expect(result.cards[0].loadPR).toBe(false);
    expect(result.cards.at(-1)!.exercise).toMatchObject({ timed: true, perSide: true });
    expect(result.cards.at(-1)!.best.reps).toBe(40);
  });
  it('retains existing foundation, technique and next-day progression gates', () => {
    const store = fixture(); const session = save(store);
    expect(strengthSpotlight(store).cards[0].suggestion).toBeNull();
    session.date = '2026-10-31'; session.feedback = { before: 'none', after: 'none', nextDay: 'none', nextDayDate: '2026-11-01', technique: true };
    expect(strengthSpotlight(store).cards[0].suggestion).not.toBeNull();
    session.feedback.nextDay = 'worse'; expect(strengthSpotlight(store).cards[0].suggestion).toBeNull();
    session.week = 1; expect(strengthSpotlight(store).cards[0].suggestion).toBeNull();
  });
});

describe('seven calendar day snapshots', () => {
  it('uses today and six preceding days, compares prior seven and ignores future entries', () => {
    const store = fixture(); store.body = [
      { id: 'excluded', date: '2026-10-19', kg: 80 }, { id: 'prior', date: '2026-10-20', kg: 60 },
      { id: 'boundary', date: '2026-10-27', kg: 61 }, { id: 'today', date: '2026-11-02', kg: 63 },
      { id: 'future', date: '2026-11-03', kg: 90 },
    ];
    expect(bodySnapshot(store, '2026-11-02')).toMatchObject({ average: 62, change: 2, count: 2, latest: { id: 'today' } });
    expect(fromKg(bodySnapshot(store, '2026-11-02').change!, 'lb')).toBeCloseTo(4.4092, 3);
  });
  it('keeps stale latest dates without presenting stale averages or fabricated points', () => {
    const store = fixture(); store.body = [{ id: 'old', date: '2020-01-01', kg: 60 }];
    expect(bodySnapshot(store, '2026-11-02')).toMatchObject({ average: null, change: null, count: 0, points: [], latest: { date: '2020-01-01' } });
    store.body = []; expect(bodySnapshot(store, '2026-11-02').latest).toBeUndefined();
  });
  it.each(['2026-03-29', '2026-10-25'])('uses calendar arithmetic across UK clock changes on %s', date => {
    const end = calendarDay(date), store = fixture();
    store.body = Array.from({ length: 15 }, (_, i) => ({ id: String(i), date: new Date((end - 14 + i) * 86400000).toISOString().slice(0, 10), kg: i }));
    expect(bodySnapshot(store, date)).toMatchObject({ count: 7, average: 11, change: 7 });
  });
  it('counts recovery logs, unique days, minutes and all overdue feedback separately', () => {
    const store = fixture(); const old = save(store); old.date = '2026-10-01';
    store.recovery = ['2026-10-26', '2026-10-27', '2026-11-02', '2026-11-02', '2026-11-03'].map((date, i) => ({ id: String(i), date, week: 5, attemptId: currentAttempt(store).id, activity: 'walking', cardio: 25, mobility: 10, note: '' }));
    expect(recoverySnapshot(store, '2026-11-02')).toMatchObject({ logs: 3, days: 2, cardio: 75, mobility: 30 });
    expect(recoverySnapshot(store, '2026-11-02').pending.map(s => s.id)).toEqual([old.id]);
  });
});

describe('volume distribution', () => {
  it('reconciles muscle and workout totals with recorded volume, including partials and extras', () => {
    const store = fixture(); const upper = save(store), lower = save(store, 2); save(store, 6);
    upper.exercises[0].sets.push({ weight: 12, reps: 6, done: true, rir: 3 }); lower.exercises[0].sets[0].done = false;
    const result = volumeDistribution(store.sessions), total = store.sessions.reduce((n, s) => n + volume(s), 0);
    expect(result.groups.reduce((n, g) => n + g.volume, 0)).toBe(total);
    expect(result.muscles.reduce((n, m) => n + m.volume, 0)).toBe(total);
    expect(result.groups.map(g => g.sessions)).toEqual([2, 1]);
  });
  it('counts timed core seconds as logged, without doubling sides or inferring seconds from reps', () => {
    const store = fixture(); save(store, 2); save(store, 4); save(store, 5);
    expect(volumeDistribution(store.sessions).coreSeconds).toBe(160);
  });
  it('ignores active records and excludes assistance, bodyweight and timed loads', () => {
    const store = fixture(); const session = save(store, 4);
    session.exercises.forEach((log, i) => { if (log.mode === 'external') log.sets.forEach(s => s.done = false); if (session.workout.exercises[i].timed) log.sets.forEach(s => s.weight = 500); });
    const active = structuredClone(session); delete active.endedAt;
    const result = volumeDistribution([session, active]);
    expect(result.groups.every(g => g.volume === 0 && g.sessions === 0)).toBe(true); expect(result.muscles).toEqual([]); expect(result.coreSeconds).toBe(80);
  });
  it('does not mutate stored history while deriving the dashboard', () => {
    const store = fixture(); save(store); const original = structuredClone(store);
    attemptSummary(store); strengthSpotlight(store); bodySnapshot(store); recoverySnapshot(store); volumeDistribution(store.sessions);
    expect(store).toEqual(original);
  });
});
