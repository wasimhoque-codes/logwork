import { WORKOUTS, type Exercise } from './data';
import { bodyTrend } from './body-trend';
import { attemptSessions, compareTrainingDates, completeSession, coreWorkoutCount, currentAttempt, doneSets, exerciseKey, localDate, progression, volume, type ExerciseLog, type Session, type SetLog, type Store } from './model';

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
  return { attempt, number, previous, sessions,
    complete: coreWorkoutCount(sessions),
    previousComplete: previous ? coreWorkoutCount(attemptSessions(store, previous)) : 0,
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
export type MovementDay = { date: string; day: number; workouts: MovementRecord[]; best: MovementRecord };

export function recordedSessions(sessions: Session[]) {
  return sessions.filter(s => s.endedAt !== undefined && doneSets(s) > 0)
    .sort(compareTrainingDates);
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

function beatsMovementRecord(candidate: MovementRecord, best: MovementRecord) {
  const direction = best.log.mode === 'assistance' && !best.exercise.timed ? -1 : 1;
  const difference = (candidate.value - best.value) * direction;
  return difference > 0 || (difference === 0 && candidate.best.reps > best.best.reps);
}

export function movementDays(series: MovementSeries): MovementDay[] {
  const days = new Map<string, MovementDay>();
  for (const record of series.records) {
    const date = record.session.date;
    const existing = days.get(date);
    if (!existing) {
      days.set(date, { date, day: calendarDay(date), workouts: [record], best: record });
      continue;
    }
    existing.workouts.push(record);
    if (beatsMovementRecord(record, existing.best)) existing.best = record;
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}

export function recentMovements(series: MovementSeries[]) {
  return [...series].sort((a, b) => Number(b.exercise.role === 'main') - Number(a.exercise.role === 'main')
    || b.records.at(-1)!.session.startedAt - a.records.at(-1)!.session.startedAt
    || a.exercise.name.localeCompare(b.exercise.name) || a.key.localeCompare(b.key)).slice(0, 4);
}

// Overview follows the lifter's recent training, with main lifts first.
export function featuredMovements(series: MovementSeries[]) {
  return [...series].sort((a, b) => Number(b.exercise.role === 'main') - Number(a.exercise.role === 'main')
    || compareTrainingDates(b.records.at(-1)!.session, a.records.at(-1)!.session)
    || a.exercise.name.localeCompare(b.exercise.name) || a.key.localeCompare(b.key)).slice(0, 4);
}

export function movementComparison(series: MovementSeries) {
  const days = movementDays(series), latest = days.at(-1)!.best;
  const previousDays = days.slice(0, -1).reverse();
  const previous = previousDays[0]?.best;
  const usesLoad = series.mode !== 'bodyweight';
  // Compare reps/seconds at the same load when there is a matching earlier set.
  let comparable: MovementRecord | undefined;
  for (const day of previousDays) {
    for (const record of day.workouts) for (const set of record.sets) {
      if ((!usesLoad || set.weight === latest.best.weight) && (!comparable || set.reps > comparable.best.reps)) {
        comparable = { ...record, best: set };
      }
    }
    if (comparable) break;
  }
  const delta = comparable ? latest.best.reps - comparable.best.reps : undefined;
  const assistanceReduction = !comparable && previous && series.mode === 'assistance' && !series.exercise.timed
    && latest.best.weight !== null && previous.best.weight !== null && latest.best.weight < previous.best.weight
    && latest.best.reps >= previous.best.reps ? previous.best.weight - latest.best.weight : undefined;
  return { latest, previous, comparable, delta, assistanceReduction,
    direction: assistanceReduction ? 'up' as const : delta === undefined || delta === 0 ? 'neutral' as const : delta > 0 ? 'up' as const : 'down' as const };
}

export function exerciseChange(series: MovementSeries) {
  const days = movementDays(series);
  return { latest: days.at(-1)!.best, previous: days.at(-2)?.best };
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
export const dateFromDay = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);
export const mondayOf = (date: string) => dateFromDay(weekDay(date));

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
  const currentWeek=weekDay(today);
  const recentWeeks=Array.from({length:8},(_,i)=>{
    const day=currentWeek-(7-i)*7;
    return weeks.get(day)??{date:new Date(day*86400000).toISOString().slice(0,10),sessions:0,volume:0};
  });
  const todayDay=calendarDay(today);
  const currentSessions=sessions.filter(session=>calendarDay(session.date)>=currentWeek&&calendarDay(session.date)<=todayDay).length;
  const previousSessions=sessions.filter(session=>calendarDay(session.date)>=currentWeek-7&&calendarDay(session.date)<=todayDay-7).length;
  return { sessions, series, recentWeeks,currentSessions,previousSessions,currentWeek:dateFromDay(currentWeek),firstDate: sessions.length ? sessions.reduce((first, s) => s.date < first ? s.date : first, sessions[0].date) : undefined,
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

export function volumeDistribution(sessions: Session[]) {
  const muscles = new Map<string, {label:string;volume:number;sets:number;exercises:Map<string,{sets:number;volume:number}>}>();
  const groups = ['Upper body', 'Lower body'].map(label => ({ label, volume: 0, sessions: 0 }));
  let coreSeconds = 0;
  for (const session of sessions.filter(s => s.endedAt !== undefined)) {
    let total = 0;
    session.workout.exercises.forEach((exercise, index) => {
      const log = session.exercises[index], amount = exerciseVolume(exercise, log);
      const sets=log.sets.filter(set=>set.done).length;
      if(sets){
        const item=muscles.get(exercise.muscle)??{label:exercise.muscle,volume:0,sets:0,exercises:new Map()};
        item.volume+=amount;item.sets+=sets;
        const contribution=item.exercises.get(exercise.name)??{sets:0,volume:0};
        contribution.sets+=sets;contribution.volume+=amount;
        item.exercises.set(exercise.name,contribution);
        muscles.set(exercise.muscle,item);
      }
      total += amount;
      if (exercise.role === 'core' && exercise.timed) coreSeconds += log.sets.reduce((n, set) => n + (set.done ? set.reps : 0), 0);
    });
    const group = groups.find(g => g.label.toLowerCase() === session.workout.label.toLowerCase());
    if (group && total > 0) { group.volume += total; group.sessions++; }
  }
  return { groups, coreSeconds, muscles: [...muscles.values()].sort((a, b) => b.volume - a.volume || a.label.localeCompare(b.label)) };
}

export function movementSummary(series: MovementSeries) {
  const first = series.records[0], latest = series.records.at(-1)!;
  const recent = series.records.slice(-5);
  const best = series.records.reduce((best, record) => beatsMovementRecord(record, best) ? record : best, first);
  return { first, latest, recent, best };
}

export function workoutPersonalRecords(sessions: Session[], session: Session) {
  const records = new Map<string,{set:SetLog;label:string}>();
  for(const series of movementSeries(sessions)){
    const index=series.records.findIndex(record=>record.session.id===session.id);
    if(index<1)continue;
    const current=series.records[index];
    const assistance=series.mode==='assistance'&&!current.exercise.timed;
    const isRecord=series.records.slice(0,index).every(record=>assistance?current.value<record.value:current.value>record.value);
    if(!isRecord)continue;
    const label=current.exercise.timed?'Longest hold':assistance?'Least assistance':series.mode==='bodyweight'?'Most reps':'Heaviest set';
    records.set(series.key,{set:current.best,label});
  }
  return records;
}


export type ExerciseChartMetric='top'|'reps'|'estimate';
export type ExerciseObservation={record:MovementRecord;value:number};

export function estimatedMax(set:SetLog) {
  if(set.weight===null||set.weight<=0||set.reps>12||set.reps<1) return null;
  return set.weight*(set.reps===1?1:1+set.reps/30);
}
export function exerciseObservation(day:MovementDay,metric:ExerciseChartMetric,load?:number):ExerciseObservation|undefined {
  if(metric==='top')return {record:day.best,value:day.best.value};
  let best:ExerciseObservation|undefined;
  for(const record of day.workouts) {
    for(const set of record.sets) {
      const value=metric==='estimate'?estimatedMax(set):set.weight===load?set.reps:null;
      if(value!==null&&(!best||value>best.value))best={record:{...record,best:set},value};
    }
  }
  return best;
}
