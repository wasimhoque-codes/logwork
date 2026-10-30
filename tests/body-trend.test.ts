import { describe, expect, it } from 'vitest';
import { bodyTrend, bodyTrendBounds } from '../src/body-trend';
import { bodyAverages, bodyGuidance, fromKg, type BodyEntry } from '../src/model';

const entries = (...pairs: [string, number][]): BodyEntry[] => pairs.map(([date, kg], index) => ({ id: String(index), date, kg }));

describe('bodyweight chart series', () => {
  it('retains every reading in the same week, sorts by date and leaves source records unchanged', () => {
    const body = entries(['2026-10-28', 69], ['2026-10-26', 70], ['2026-10-27', 71]);
    const original = structuredClone(body), points = bodyTrend(body);
    expect(points.map(point => point.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28']);
    expect(points.map(point => point.averageKg)).toEqual([70, 70.5, 70]);
    expect(points.map(point => point.count)).toEqual([1, 2, 3]);
    expect(body).toEqual(original);
  });
  it('uses actual calendar spacing rather than equally spacing irregular readings', () => {
    const points = bodyTrend(entries(['2026-10-01', 70], ['2026-10-03', 71], ['2026-10-06', 72]));
    expect(points.map(point => point.position)).toEqual([0, .4, 1]);
  });
  it('includes six previous calendar days and excludes the seventh', () => {
    const points = bodyTrend(entries(['2026-01-01', 10], ['2026-01-07', 20], ['2026-01-08', 30]));
    expect(points.map(point => point.averageKg)).toEqual([10, 15, 25]);
    expect(points.map(point => point.count)).toEqual([1, 2, 2]);
  });
  it('does not fill missing days and restarts the average after long gaps', () => {
    const points = bodyTrend(entries(['2026-01-01', 70], ['2026-02-01', 72], ['2026-02-02', 74]));
    expect(points).toHaveLength(3);
    expect(points.map(point => point.averageKg)).toEqual([70, 72, 73]);
    expect(points.map(point => point.count)).toEqual([1, 1, 2]);
  });
  it.each([['2026-03-28', '2026-03-29', '2026-03-30'], ['2026-10-24', '2026-10-25', '2026-10-26']])('keeps calendar spacing through DST near %s', (a, b, c) => {
    const points = bodyTrend(entries([a, 70], [b, 71], [c, 72]));
    expect(points.map(point => point.position)).toEqual([0, .5, 1]);
    expect(points[1].day - points[0].day).toBe(1);
    expect(points[2].averageKg).toBe(71);
  });
  it('handles no history and centres a single real reading without adding records', () => {
    expect(bodyTrend([])).toEqual([]); expect(bodyTrendBounds([])).toEqual({ low: 0, high: 1 });
    const points = bodyTrend(entries(['2026-01-01', 70]));
    expect(points).toHaveLength(1); expect(points[0]).toMatchObject({ kg: 70, averageKg: 70, count: 1, position: .5 });
  });
  it('keeps flat weights and tiny fluctuations on a useful minimum one-kilogram scale', () => {
    const flat = bodyTrend(entries(['2026-01-01', 70], ['2026-01-02', 70]));
    expect(bodyTrendBounds(flat)).toEqual({ low: 69.5, high: 70.5 });
    const bounds = bodyTrendBounds(bodyTrend(entries(['2026-01-01', 70], ['2026-01-02', 70.01])));
    expect(bounds.high - bounds.low).toBeGreaterThanOrEqual(1);
    expect(bounds.low).toBeLessThan(70); expect(bounds.high).toBeGreaterThan(70.01);
  });
  it('preserves old readings, canonical kilograms and correct pound conversion', () => {
    const body = entries(['2020-01-01', 60], ['2026-10-26', 70], ['2026-10-27', 72]);
    const points = bodyTrend(body), latest = points.at(-1)!;
    expect(points).toHaveLength(3); expect(latest.averageKg).toBe(71);
    expect(fromKg(latest.averageKg, 'lb')).toBeCloseTo((fromKg(70, 'lb') + fromKg(72, 'lb')) / 2);
    expect(body[0].kg).toBe(60);
  });
  it('leaves weekly summaries and existing programme guidance unchanged', () => {
    const body = entries(['2026-09-14', 60], ['2026-09-15', 60], ['2026-09-21', 60], ['2026-09-22', 60], ['2026-09-28', 60], ['2026-09-29', 60]);
    const weekly = bodyAverages(body), guidance = bodyGuidance(body, '2026-10-09');
    bodyTrend(body);
    expect(bodyAverages(body)).toEqual(weekly); expect(bodyGuidance(body, '2026-10-09')).toBe(guidance);
    expect(guidance).toContain('100–150');
  });
});
