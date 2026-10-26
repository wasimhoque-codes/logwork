import { DEFAULT_ROUTINE_OPTIONS, WORKOUTS, configuredWorkout, plannedSets, type RoutineOptions, type Unit, type LoadMode, type Exercise, type Workout } from './back-support-data';
import { LEGACY_WORKOUTS } from './legacy-data';
export type SetLog = {
    weight: number | null;
    reps: number;
    rir: number | null;
    done: boolean;
};
export type ExerciseLog = {
    id: string;
    name: string;
    mode: LoadMode;
    sets: SetLog[];
    note: string;
};
export type Session = {
    id: string;
    workoutId: string;
    programId: 'original' | 'back-support';
    workout: Workout;
    date: string;
    startedAt: number;
    endedAt?: number;
    phase: 'full' | 'ramp';
    exercises: ExerciseLog[];
    note: string;
};
export type BodyEntry = {
    id: string;
    date: string;
    kg: number;
};
export type Settings = {
    name: string;
    unit: Unit;
    phase: 'full' | 'ramp';
    autoRest: boolean;
    routine: RoutineOptions;
};
export type Store = {
    version: 2;
    settings: Settings;
    sessions: Session[];
    active: Session | null;
    body: BodyEntry[];
};
export const STORAGE_KEY = 'gym-hawk-v2';
export const LEGACY_STORAGE_KEY = 'gym-hawk-v1';
export const freshStore = (): Store => ({ version: 2, settings: { name: '', unit: 'kg', phase: 'full', autoRest: true, routine: { ...DEFAULT_ROUTINE_OPTIONS } }, sessions: [], active: null, body: [] });
export function localDate(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function monday(d = new Date()) { const start = new Date(d); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (start.getDay() + 6) % 7); return start; }
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) { return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', options); }
export const fromKg = (kg: number, unit: Unit) => unit === 'lb' ? kg * 2.2046226218 : kg;
export const toKg = (n: number, unit: Unit) => unit === 'lb' ? n / 2.2046226218 : n;
export function number(n: number, decimals = 1) { return new Intl.NumberFormat('en-GB', { maximumFractionDigits: decimals }).format(n); }
export function doneSets(s: Session) { return s.exercises.flatMap(e => e.sets).filter(s => s.done).length; }
export function volume(s: Session) { return s.exercises.reduce((total, e) => total + (e.mode === 'external' && !s.workout.exercises.find(x => x.id === e.id)?.timed ? e.sets.filter(s => s.done).reduce((n, s) => n + (s.weight ?? 0) * s.reps, 0) : 0), 0); }
export function previousExercise(sessions: Session[], id: string, mode?: LoadMode) { return [...sessions].sort((a, b) => b.startedAt - a.startedAt).flatMap(s => s.exercises).find(e => e.id === id && (!mode || mode === e.mode) && e.sets.some(s => s.done)); }
export function sessionWorkout(s: Session) { return s.workout; }
export function coreWorkoutCount(sessions: Session[]) { return new Set(sessions.filter(s => ['upper-a', 'lower-a', 'upper-b', 'lower-b'].includes(s.workoutId)).map(s => s.workoutId)).size; }
export function newSession(w: Workout, store: Store): Session {
    const workout = configuredWorkout(w, store.settings.routine);
    const phase = workout.category === 'recovery' ? 'full' : store.settings.phase;
    return { id: crypto.randomUUID(), workoutId: workout.id, programId: 'back-support', workout, date: localDate(), startedAt: Date.now(), phase, note: '', exercises: workout.exercises.map(e => {
        const previous = previousExercise(store.sessions, e.id);
        const mode = e.mode === 'bodyweight' && e.id !== 'pullups' ? 'bodyweight' : previous?.mode ?? e.mode ?? 'external';
        return { id: e.id, name: e.name, mode, note: '', sets: Array.from({ length: plannedSets(e, phase) }, (_, i) => {
            const last = previous?.sets.filter(s => s.done)[i] ?? previous?.sets.filter(s => s.done).at(-1);
            return { weight: mode === 'bodyweight' ? 0 : last?.weight ?? null, reps: last?.reps ?? e.min, rir: phase === 'ramp' && e.rir !== '—' ? 3 : null, done: false };
        }) };
    }) };
}
export function progression(e: Exercise, log: ExerciseLog, phase: Session['phase']) {
    const sets = log.sets.filter(s => s.done);
    if (e.recovery || e.kind === 'core' || e.timed || phase === 'ramp' || sets.length < e.sets || log.mode !== 'external')
        return null;
    const load = sets[0]?.weight;
    if (!load || !sets.every(s => s.reps >= e.max && s.weight === load))
        return null;
    return { kg: load, increment: e.kind === 'lower' ? 2.5 : e.kind === 'upper' ? 1.25 : null };
}
export function weekSessions(sessions: Session[], start = monday()) { const end = new Date(start); end.setDate(end.getDate() + 7); return sessions.filter(s => s.date >= localDate(start) && s.date < localDate(end)); }
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const validDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && localDate(new Date(`${v}T12:00:00`)) === v;
const shortString = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length <= max;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
// Validate the complete record before migrating or writing it. Version-1 storage is never removed.
export function validateStore(value: unknown): Store {
    if (!record(value) || ![1, 2].includes(value.version as number) || !record(value.settings) || !['kg', 'lb'].includes(String(value.settings.unit)) || !['ramp', 'full'].includes(String(value.settings.phase)) || typeof value.settings.autoRest !== 'boolean' || !shortString(value.settings.name, 60) || !Array.isArray(value.sessions) || !Array.isArray(value.body) || value.sessions.length > 10000 || value.body.length > 20000)
        throw new Error('This file isn’t a valid Gym Hawk backup.');
    if (value.version === 1) {
        const migrateSession = (s: unknown) => {
            if (!record(s) || !Array.isArray(s.exercises)) throw new Error('The backup contains invalid workout records.');
            const original = LEGACY_WORKOUTS.find(w => w.id === s.workoutId);
            if (!original || s.exercises.length !== original.exercises.length) throw new Error('The backup contains invalid workout records.');
            const exercises = s.exercises.map(e => {
                const spec = record(e) && original.exercises.find(x => x.id === e.id);
                if (!spec) throw new Error('The backup contains invalid workout records.');
                return { ...spec };
            });
            return { ...s, programId: 'original', workout: { ...original, exercises } };
        };
        return validateStore({ ...value, version: 2, settings: { ...value.settings, routine: { ...DEFAULT_ROUTINE_OPTIONS } }, sessions: value.sessions.map(migrateSession), active: value.active === null ? null : migrateSession(value.active) });
    }
    if (value.version !== 2 || !record(value.settings.routine) || ![2, 3].includes(value.settings.routine.recoveryRounds as number) || !['curl', 'rdl'].includes(String(value.settings.routine.fridayHinge)))
        throw new Error('This file isn’t a valid Gym Hawk backup.');
    const exerciseValid = (e: unknown): e is Exercise => record(e) && shortString(e.id, 100) && shortString(e.name, 100) && shortString(e.muscle, 100) && finite(e.sets, 1, 10) && Number.isInteger(e.sets) && finite(e.min, 1, 1000) && Number.isInteger(e.min) && finite(e.max, Number(e.min), 1000) && Number.isInteger(e.max) && finite(e.rest, 0, 3600) && shortString(e.rir, 30) && ['upper', 'lower', 'isolation', 'core', 'carry'].includes(String(e.kind)) && (e.note === undefined || shortString(e.note)) && (e.mode === undefined || ['external', 'bodyweight', 'assistance'].includes(String(e.mode))) && ['timed', 'perSide', 'recovery'].every(key => e[key] === undefined || typeof e[key] === 'boolean');
    const sessionValid = (s: unknown): boolean => {
        if (!record(s) || !shortString(s.id, 100) || !['original', 'back-support'].includes(String(s.programId)) || !validDate(s.date) || !finite(s.startedAt, 0, 9e12) || (s.endedAt !== undefined && !finite(s.endedAt, Number(s.startedAt), 9e12)) || !['ramp', 'full'].includes(String(s.phase)) || !shortString(s.note) || !Array.isArray(s.exercises) || !record(s.workout)) return false;
        const template = (s.programId === 'original' ? LEGACY_WORKOUTS : WORKOUTS).find(w => w.id === s.workoutId);
        const w = s.workout;
        if (!template || w.id !== s.workoutId || w.category !== template.category || !shortString(w.name, 100) || !shortString(w.focus, 200) || !shortString(w.subtitle, 200) || !shortString(w.label, 100) || !Array.isArray(w.days) || !w.days.every(d => finite(d, 0, 6) && Number.isInteger(d)) || (w.optional !== undefined && typeof w.optional !== 'boolean') || !Array.isArray(w.exercises) || w.exercises.length !== template.exercises.length || s.exercises.length !== w.exercises.length || !w.exercises.every(exerciseValid) || new Set(s.exercises.map(e => record(e) ? e.id : null)).size !== s.exercises.length) return false;
        const allowed = new Set(template.exercises.map(e => e.id));
        if (s.programId === 'back-support' && s.workoutId === 'lower-b') allowed.add('db-rdl');
        // The Friday replacement is one slot, never both the RDL and its curl substitute.
        if (!w.exercises.every(e => allowed.has(e.id)) || (s.workoutId === 'lower-b' && s.programId === 'back-support' && (w.exercises.filter(e => e.id === 'db-rdl' || e.id === 'hinge-curl').length !== 1 || template.exercises.filter(e => e.id !== 'hinge-curl').some(e => !(w.exercises as Exercise[]).some(x => x.id === e.id))))) return false;
        return s.exercises.every((e, i) => record(e) && e.id === (w.exercises as Exercise[])[i].id && shortString(e.name, 100) && ['external', 'bodyweight', 'assistance'].includes(String(e.mode)) && shortString(e.note) && Array.isArray(e.sets) && e.sets.length >= 1 && e.sets.length <= 10 && e.sets.every(set => record(set) && (set.weight === null || finite(set.weight, 0, 2000)) && finite(set.reps, set.done ? 1 : 0, 1000) && Number.isInteger(set.reps) && (set.rir === null || (finite(set.rir, 0, 10) && Number.isInteger(set.rir))) && typeof set.done === 'boolean' && (!set.done || set.weight !== null)));
    };
    if (!value.sessions.every(s => sessionValid(s) && record(s) && typeof s.endedAt === 'number' && (s.exercises as ExerciseLog[]).some(e => e.sets.some(s => s.done))) || (value.active !== null && (!sessionValid(value.active) || (value.active as Session).endedAt !== undefined)) || !value.body.every(b => record(b) && shortString(b.id, 100) && validDate(b.date) && finite(b.kg, 20, 500)))
        throw new Error('The backup contains invalid workout or bodyweight records.');
    if (new Set(value.sessions.map(s => s.id)).size !== value.sessions.length || (record(value.active) && value.sessions.some(s => record(s) && s.id === (value.active as Record<string, unknown>).id)) || new Set(value.body.map(b => b.date)).size !== value.body.length || new Set(value.body.map(b => b.id)).size !== value.body.length)
        throw new Error('The backup contains duplicate records.');
    return value as unknown as Store;
}
export function readStore(): { store: Store; error?: string; corrupt?: boolean } {
    let raw: string | null;
    try { raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY); }
    catch { return { store: freshStore(), error: 'Browser storage is unavailable. Your changes are temporary; export a backup before closing the app.' }; }
    try { return { store: raw ? validateStore(JSON.parse(raw)) : freshStore() }; }
    catch { return { store: freshStore(), corrupt: true, error: 'Saved data could not be read. Export or restore a backup in Settings before making changes.' }; }
}
