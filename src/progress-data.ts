import { WORKOUTS, type Exercise } from './data';
import { bodyTrend } from './body-trend';
import { attemptSessions, completeSession, coreWorkoutCount, currentAttempt, exerciseKey, localDate, pendingFollowups, progression, type ExerciseLog, type Session, type SetLog, type Store } from './model';

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
