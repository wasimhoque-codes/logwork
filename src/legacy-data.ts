// Frozen prescriptions for version-1 backups and unfinished sessions.
import type { Exercise, Workout } from './data';
const exercise = (id: string, name: string, muscle: string, sets: number, min: number, max: number, rest: number, rir: string, kind: Exercise['kind'], extra: Partial<Exercise> = {}): Exercise => ({ id, name, muscle, sets, min, max, rest, rir, kind, ...extra });
export const LEGACY_WORKOUTS: Workout[] = [
    { id: 'upper-a', name: 'Upper A', subtitle: 'Build your foundation.', focus: 'Chest & back · Strength', days: [1], label: 'Upper body', category: 'strength', exercises: [
            exercise('bench', 'Barbell Bench Press', 'Chest', 4, 5, 8, 180, '1–3', 'upper'),
            exercise('chest-row', 'Chest-Supported Row', 'Back', 4, 6, 10, 150, '1–3', 'upper'),
            exercise('incline-press', 'Incline Dumbbell Press', 'Chest', 3, 8, 12, 120, '1–3', 'upper', { note: 'Log the weight of one dumbbell.' }),
            exercise('pulldown', 'Neutral-Grip Lat Pulldown', 'Back', 3, 8, 12, 120, '1–2', 'upper'),
            exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 3, 12, 20, 90, '0–2', 'isolation'),
            exercise('rope-triceps', 'Rope Triceps Pressdown', 'Triceps', 2, 10, 15, 90, '0–2', 'isolation'),
            exercise('incline-curl', 'Incline Dumbbell Curl', 'Biceps', 2, 10, 15, 90, '0–2', 'isolation', { note: 'Log the weight of one dumbbell.' }),
        ] },
    { id: 'lower-a', name: 'Lower A', subtitle: 'Strong from the ground up.', focus: 'Quads & hamstrings · Strength', days: [2], label: 'Lower body', category: 'strength', exercises: [
            exercise('squat', 'Back Squat', 'Quads', 4, 5, 8, 180, '1–3', 'lower'),
            exercise('rdl', 'Romanian Deadlift', 'Hamstrings', 3, 6, 10, 180, '1–3', 'lower', { note: 'Prioritize a controlled hamstring stretch over heavier weight.' }),
            exercise('leg-press', 'Leg Press', 'Quads', 3, 10, 15, 120, '1–2', 'lower'),
            exercise('seated-curl', 'Seated Leg Curl', 'Hamstrings', 3, 10, 15, 90, '1–2', 'isolation'),
            exercise('standing-calf', 'Standing Calf Raise', 'Calves', 4, 8, 15, 90, '0–2', 'isolation'),
            exercise('crunch', 'Cable Crunch', 'Core', 3, 10, 15, 90, '0–2', 'core'),
        ] },
    { id: 'upper-b', name: 'Upper B', subtitle: 'Make room for growth.', focus: 'Shoulders & back · Hypertrophy', days: [4], label: 'Upper body', category: 'strength', exercises: [
            exercise('ohp', 'Overhead Press', 'Shoulders', 3, 6, 10, 150, '1–3', 'upper', { note: 'Use a barbell or dumbbells; keep the same variation between sessions. For dumbbells, log one dumbbell.' }),
            exercise('pullups', 'Pull-Ups', 'Back', 4, 6, 10, 150, '1–3', 'upper', { mode: 'bodyweight', note: 'Choose bodyweight, added weight, or assistance below. You can substitute a lat pulldown.' }),
            exercise('machine-press', 'Machine Chest Press', 'Chest', 3, 8, 12, 120, '1–2', 'upper'),
            exercise('cable-row', 'Seated Cable Row', 'Back', 3, 8, 12, 120, '1–2', 'upper'),
            exercise('pec-deck', 'Pec Deck', 'Chest', 2, 10, 15, 90, '1–2', 'isolation'),
            exercise('reverse-pec', 'Reverse Pec Deck', 'Shoulders', 3, 12, 20, 90, '0–2', 'isolation'),
            exercise('ez-curl', 'EZ-Bar Curl', 'Biceps', 3, 8, 12, 90, '0–2', 'isolation'),
            exercise('overhead-cable', 'Overhead Cable Triceps Extension', 'Triceps', 3, 10, 15, 90, '0–2', 'isolation'),
        ] },
    { id: 'lower-b', name: 'Lower B', subtitle: 'Build a stronger base.', focus: 'Legs & glutes · Hypertrophy', days: [5], label: 'Lower body', category: 'strength', exercises: [
            exercise('hack', 'Hack Squat', 'Quads', 3, 8, 12, 150, '1–2', 'lower'),
            exercise('hip-thrust', 'Hip Thrust', 'Glutes', 3, 8, 12, 120, '1–3', 'lower', { note: 'Use a barbell or machine; keep the same variation for consistent comparisons.' }),
            exercise('split-squat', 'Bulgarian Split Squat', 'Quads', 3, 8, 12, 120, '1–3', 'lower', { note: 'Reps are per leg. Log the weight of one dumbbell.' }),
            exercise('lying-curl', 'Lying Leg Curl', 'Hamstrings', 3, 10, 15, 90, '1–2', 'isolation'),
            exercise('extension', 'Leg Extension', 'Quads', 2, 12, 15, 90, '1–2', 'isolation'),
            exercise('seated-calf', 'Seated Calf Raise', 'Calves', 4, 10, 15, 90, '0–2', 'isolation'),
            exercise('knee-raise', 'Hanging Knee Raise', 'Core', 3, 8, 15, 90, '0–2', 'core', { mode: 'bodyweight' }),
        ] },
    { id: 'optional', name: 'Arms & shoulders', subtitle: 'A little extra, if you’re ready.', focus: 'Arms & shoulders · Optional', days: [6], label: 'Accessories', category: 'optional', optional: true, exercises: [
            exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 4, 12, 20, 90, '0–2', 'isolation'),
            exercise('reverse-fly', 'Reverse Cable Fly', 'Shoulders', 3, 12, 20, 90, '0–2', 'isolation'),
            exercise('preacher', 'Preacher Curl', 'Biceps', 3, 10, 15, 90, '0–2', 'isolation'),
            exercise('hammer', 'Rope Hammer Curl', 'Biceps', 2, 10, 15, 90, '0–2', 'isolation'),
            exercise('cable-triceps', 'Cable Triceps Pressdown', 'Triceps', 3, 10, 15, 90, '0–2', 'isolation'),
            exercise('overhead-triceps', 'Overhead Triceps Extension', 'Triceps', 2, 10, 15, 90, '0–2', 'isolation'),
            exercise('carry', 'Farmer’s Carry', 'Full body', 3, 30, 60, 90, '—', 'carry', { timed: true, note: 'Log one hand’s load and duration in seconds. Timed carries are excluded from lifting volume.' }),
        ] },
];
