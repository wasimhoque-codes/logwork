import type { BodyEntry } from './model';

export type BodyTrendPoint = BodyEntry & { day: number; averageKg: number; count: number; position: number };

// Calendar-day arithmetic keeps the seven-day window independent of DST.
export function bodyTrend(body: BodyEntry[]): BodyTrendPoint[] {
  const entries = [...body].sort((a, b) => a.date.localeCompare(b.date));
  const days = entries.map(entry => {
    const [year, month, day] = entry.date.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  });
  let start = 0, sum = 0;
  return entries.map((entry, index) => {
    sum += entry.kg;
    while (days[start] < days[index] - 6) sum -= entries[start++].kg;
    const count = index - start + 1;
    return { ...entry, day: days[index], averageKg: sum / count, count,
      position: days.at(-1) === days[0] ? .5 : (days[index] - days[0]) / (days.at(-1)! - days[0]) };
  });
}

export function bodyTrendBounds(points: BodyTrendPoint[]) {
  if (!points.length) return { low: 0, high: 1 };
  const { min, max } = points.reduce((bounds, point) => ({ min: Math.min(bounds.min, point.kg), max: Math.max(bounds.max, point.kg) }), { min: Infinity, max: -Infinity });
  const span = Math.max(1, (max - min) * 1.3), centre = (min + max) / 2;
  return { low: Math.max(0, Math.floor((centre - span / 2) * 10) / 10), high: Math.ceil((centre + span / 2) * 10) / 10 };
}
