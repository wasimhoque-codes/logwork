import { describe, expect, it } from 'vitest';
import { programmeDay, programmeDays, programmePage, resolvePage } from '../src/routes';

describe('Programme navigation', () => {
  it.each(programmeDays)('opens the %s session directly', day => {
    const index = programmeDays.indexOf(day);
    const route = programmePage(index);
    expect(resolvePage('#' + route)).toBe(route);
    expect(programmeDay(resolvePage('#' + route))).toBe(index);
  });
  it('retains old links and falls back to the overview for an unknown day', () => {
    expect(resolvePage('#plan')).toBe('programme');
    expect(resolvePage('#programme/unknown')).toBe('programme');
    expect(programmeDay('programme')).toBeUndefined();
    expect(programmeDay('today')).toBeUndefined();
  });
});
