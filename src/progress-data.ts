import { WORKOUTS, type Exercise } from './data';
import { bodyTrend } from './body-trend';
import { attemptSessions, completeSession, coreWorkoutCount, currentAttempt, doneSets, exerciseKey, localDate, pendingFollowups, progression, volume, type ExerciseLog, type Session, type SetLog, type Store } from './model';

// Date-only arithmetic must not gain or lose a day when the clocks change.
export function calendarDay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

export function attemptSummary(store: Store) {
  const attempts = store.programme.attempts, attempt = currentAttempt(store);
  let start = attempts.length - 1;
  while (start > 0 && attempts[start - 1].week === attempt.week && attempts[start - 1].decision === 'repeat') start--;
  const number = attempts.length - start, previous = number > 1 ? attempts.at(-2) : undefined;
  const sessions = attemptSessions(store).filter(s => s.endedAt !== undefined);
  const recovery = store.recovery.filter(r => r.attemptId === attempt.id);
  return { attempt, number, previous, sessions,
    complete: coreWorkoutCount(sessions),
    previousComplete: previous ? coreWorkoutCount(attemptSessions(store, previous)) : 0,
    recoveryDays: new Set(recovery.map(r => r.date)).size,
    cardio: recovery.reduce((n, r) => n + r.cardio, 0),
    workouts: WORKOUTS.filter(w => w.category === 'strength').map(w => ({ id: w.id, name: w.name,
      status: sessions.some(s => s.workoutId === w.id && completeSession(s)) ? 'complete' as const
        : sessions.some(s => s.workoutId === w.id) ? 'partial' as const : 'pending' as const })),
  };
}

export function exerciseVolume(exercise: Exercise, log: ExerciseLog) {
  return log.mode === 'external' && !exercise.timed
    ? log.sets.reduce((n, set) => n + (set.done ? (set.weight ?? 0) * set.reps : 0), 0) : 0;
}

function bestSet(exercise: Exercise, log: ExerciseLog): SetLog | undefined {
  return [...log.sets.filter(set => set.done)].sort((a, b) => log.mode === 'bodyweight' || exercise.timed
    ? b.reps - a.reps : (log.mode === 'assistance' ? (a.weight ?? 0) - (b.weight ?? 0) : (b.weight ?? 0) - (a.weight ?? 0)) || b.reps - a.reps)[0];
}

export type MovementRecord = { session: Session; exercise: Exercise; log: ExerciseLog; sets: SetLog[]; best: SetLog; value: number };
export type MovementSeries = { key: string; exercise: Exercise; mode: ExerciseLog['mode']; records: MovementRecord[] };

export function recordedSessions(sessions: Session[]) {
  return sessions.filter(s => s.endedAt !== undefined && doneSets(s) > 0)
    .sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
}

// Keep one observation per exercise identity per saved workout, including extra sets.
export function movementSeries(sessions: Session[]): MovementSeries[] {
  const series = new Map<string, MovementSeries>();
  for (const session of recordedSessions(sessions)) {
    const observations = new Map<string, { exercise: Exercise; log: ExerciseLog }>();
    session.workout.exercises.forEach((exercise, index) => {
      const log = session.exercises[index];
      if (!log?.sets.some(set => set.done)) return;
      const key = exerciseKey(exercise, log.mode), previous = observations.get(key);
      observations.set(key, { exercise, log: previous ? { ...log, sets: [...previous.log.sets, ...log.sets] } : log });
    });
    for (const [key, { exercise, log }] of observations) {
      const best = bestSet(exercise, log)!;
      const item = series.get(key) ?? { key, exercise, mode: log.mode, records: [] };
      item.exercise = exercise;
      item.records.push({ session, exercise, log, sets: log.sets.filter(set => set.done), best,
        value: exercise.timed || log.mode === 'bodyweight' ? best.reps : best.weight ?? 0 });
      series.set(key, item);
    }
  }
  return [...series.values()];
}

export function recentMovements(series: MovementSeries[]) {
  return [...series].sort((a, b) => Number(b.exercise.role === 'main') - Number(a.exercise.role === 'main')
    || b.records.at(-1)!.session.startedAt - a.records.at(-1)!.session.startedAt
    || a.exercise.name.localeCompare(b.exercise.name) || a.key.localeCompare(b.key)).slice(0, 4);
}

export function defaultMovement(series: MovementSeries[]) {
  return [...series].sort((a, b) => Number(b.exercise.role === 'main') - Number(a.exercise.role === 'main')
    || b.records.length - a.records.length || b.records.at(-1)!.session.startedAt - a.records.at(-1)!.session.startedAt
    || a.exercise.name.localeCompare(b.exercise.name) || a.key.localeCompare(b.key))[0];
}

const weekDay = (date: string) => {
  const day = calendarDay(date);
  return day - (new Date(day * 86400000).getUTCDay() + 6) % 7;
};

export function trainingJourney(store: Store, today = localDate()) {
  const sessions = recordedSessions(store.sessions), series = movementSeries(sessions);
  const weeks = new Map<number, { date: string; sessions: number; volume: number }>();
  for (const session of sessions) {
    const day = weekDay(session.date), week = weeks.get(day) ?? { date: new Date(day * 86400000).toISOString().slice(0, 10), sessions: 0, volume: 0 };
    week.sessions++; week.volume += volume(session); weeks.set(day, week);
  }
  const activeWeeks = weeks.size;
  if (sessions.length) {
    const first = Math.min(...weeks.keys()), last = Math.max(weekDay(today), ...weeks.keys());
    for (let day = first; day <= last; day += 7) if (!weeks.has(day)) weeks.set(day, { date: new Date(day * 86400000).toISOString().slice(0, 10), sessions: 0, volume: 0 });
  }
  return { sessions, series, firstDate: sessions.length ? sessions.reduce((first, s) => s.date < first ? s.date : first, sessions[0].date) : undefined,
    sets: sessions.reduce((n, s) => n + doneSets(s), 0), activeWeeks,
    weeks: [...weeks].sort(([a], [b]) => a - b).map(([, week]) => week) };
}

export function strengthSpotlight(store: Store) {
  const summary = attemptSummary(store);
  const session = [...summary.sessions].filter(s => s.exercises.some(log => log.sets.some(set => set.done))).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!session) return { session: undefined, baseline: undefined, repeat: !!summary.previous, cards: [] };
  const earlier = store.sessions.filter(s => s.endedAt !== undefined && s.startedAt < session.startedAt).sort((a, b) => b.startedAt - a.startedAt);
  const baseline = earlier.find(s => s.workoutId === session.workoutId && (!summary.previous || s.attemptId === summary.previous.id));
  const recorded = session.workout.exercises.flatMap((exercise, index) => {
    const log = session.exercises[index], best = bestSet(exercise, log);
    if (!best) return [];
    const key = exerciseKey(exercise, log.mode);
    const baselineIndex = baseline?.workout.exercises.findIndex((ex, i) => exerciseKey(ex, baseline.exercises[i].mode) === key) ?? -1;
    const previousLog = baselineIndex >= 0 ? baseline!.exercises[baselineIndex] : undefined;
    const previousBest = previousLog && bestSet(baseline!.workout.exercises[baselineIndex], previousLog);
    const priorLoads = earlier.flatMap(s => s.workout.exercises.flatMap((ex, i) => exerciseKey(ex, s.exercises[i].mode) === key
      ? s.exercises[i].sets.filter(set => set.done && set.weight !== null).map(set => set.weight!) : []));
    const currentVolume = exerciseVolume(exercise, log), previousVolume = previousLog ? exerciseVolume(baseline!.workout.exercises[baselineIndex], previousLog) : 0;
    return [{ exercise, log, key, best, previousBest, volume: currentVolume,
      previousSets: previousLog?.sets.filter(set => set.done).length ?? 0,
      sets: log.sets.filter(set => set.done).length,
      volumeChange: previousBest && previousVolume > 0 ? (currentVolume - previousVolume) / previousVolume * 100 : null,
      loadPR: log.mode === 'external' && !exercise.timed && priorLoads.length > 0 && best.weight !== null && best.weight > priorLoads.reduce((max, load) => Math.max(max, load), 0),
      suggestion: progression(exercise, log, session),
    }];
  });
  const chosen = [...recorded.filter(c => c.exercise.role === 'main').slice(0, 2),
    ...recorded.filter(c => c.exercise.role === 'accessory').slice(0, 1),
    ...recorded.filter(c => c.exercise.role === 'core').slice(0, 1)];
  for (const card of recorded) if (chosen.length < 4 && !chosen.includes(card)) chosen.push(card);
  return { session, baseline, repeat: !!summary.previous, cards: chosen };
}

export function bodySnapshot(store: Store, today = localDate()) {
  const end = calendarDay(today), points = bodyTrend(store.body.filter(b => b.date <= today));
  const recent = points.filter(p => p.day >= end - 6), previous = points.filter(p => p.day >= end - 13 && p.day < end - 6);
  const mean = (entries: typeof points) => entries.length ? entries.reduce((n, p) => n + p.kg, 0) / entries.length : null;
  const average = mean(recent), previousAverage = mean(previous);
  return { latest: points.at(-1), points: recent, average, count: recent.length,
    change: average !== null && previousAverage !== null ? average - previousAverage : null,
    startDay: end - 6, endDay: end };
}

export function recoverySnapshot(store: Store, today = localDate()) {
  const end = calendarDay(today), inWindow = (date: string) => calendarDay(date) >= end - 6 && calendarDay(date) <= end;
  const entries = store.recovery.filter(r => inWindow(r.date));
  return { logs: entries.length, days: new Set(entries.map(r => r.date)).size,
    cardio: entries.reduce((n, r) => n + r.cardio, 0), mobility: entries.reduce((n, r) => n + r.mobility, 0),
    // Follow-ups remain actionable even when the workout is older than the snapshot.
    pending: pendingFollowups(store, today) };
}

export function volumeDistribution(sessions: Session[]) {
  const muscles = new Map<string, number>();
  const groups = ['Upper body', 'Lower body'].map(label => ({ label, volume: 0, sessions: 0 }));
  let coreSeconds = 0;
  for (const session of sessions.filter(s => s.endedAt !== undefined)) {
    let total = 0;
    session.workout.exercises.forEach((exercise, index) => {
      const log = session.exercises[index], amount = exerciseVolume(exercise, log);
      if (amount > 0) muscles.set(exercise.muscle, (muscles.get(exercise.muscle) ?? 0) + amount);
      total += amount;
      if (exercise.role === 'core' && exercise.timed) coreSeconds += log.sets.reduce((n, set) => n + (set.done ? set.reps : 0), 0);
    });
    const group = groups.find(g => g.label.toLowerCase() === session.workout.label.toLowerCase());
    if (group && total > 0) { group.volume += total; group.sessions++; }
  }
  return { groups, coreSeconds, muscles: [...muscles].map(([label, volume]) => ({ label, volume })).sort((a, b) => b.volume - a.volume || a.label.localeCompare(b.label)) };
}
