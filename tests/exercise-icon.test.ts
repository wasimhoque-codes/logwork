import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { allExercises, VARIANTS } from '../src/data';
import { allExercises as historicalExercises } from '../src/back-support-data';
import { ExerciseIcon, exerciseIconSpec, hasExerciseIcon } from '../src/exercise-icon';

describe('exercise emblems', () => {
  it('covers every current, optional, variant and supported historical exercise', () => {
    const catalogue = [...allExercises, ...Object.values(VARIANTS).flat(), ...historicalExercises];
    expect(catalogue.filter(exercise => !hasExerciseIcon(exercise.id)).map(exercise => exercise.id)).toEqual([]);
    for (const exercise of catalogue) {
      const svg = renderToStaticMarkup(createElement(ExerciseIcon, { exercise }));
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toMatch(/<path d="M/);
      expect(svg).not.toContain('undefined');
    }
  });

  it('distinguishes variations whose equipment or movement differs', () => {
    const groups = [
      ['p16-incline-pushup', 'p16-floor-pushup', 'p16-feet-pushup'],
      ['p16-pullup', 'p16-assisted-pullup'], ['p16-dip', 'p16-assisted-dip', 'p16-weighted-dip'],
      ['p16-floor-bridge', 'p16-band-bridge', 'p16-resisted-bridge'],
      ['p16-seated-curl', 'p16-lying-curl'],
    ];
    for (const group of groups) {
      expect(new Set(group.map(id => JSON.stringify(exerciseIconSpec(id)))).size).toBe(group.length);
    }
  });

  it('uses a safe neutral fallback for unknown imported IDs, including object property names', () => {
    for (const id of ['custom-exercise', '__proto__', 'constructor']) {
      expect(hasExerciseIcon(id)).toBe(false);
      expect(exerciseIconSpec(id).emblem).toBe('dumbbell');
      expect(renderToStaticMarkup(createElement(ExerciseIcon, { exercise: { id } }))).toContain('<path d="M');
    }
  });
});
