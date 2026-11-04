import { test, expect, type Page } from '@playwright/test';
import { freshStore, selectedWorkout, newSession, reviewWeek, currentAttempt, localDate, exerciseKey, validateStore, type Store } from '../../src/model';
import { recentMovements, movementSeries } from '../../src/progress-data';
import fs from 'node:fs/promises';
import path from 'node:path';

const NOW = new Date('2026-11-02T12:00:00Z');
function fixture() {
  let store = freshStore(); store.programme.week = 5; store.programme.attempts[0].week = 5; store.programme.attempts[0].started = '2026-10-26';
  function save(day: number, date: string, load: number, partial = false) {
    const session = newSession(selectedWorkout(store, day)!, store);
    session.date = date; session.startedAt = Date.parse(date + 'T10:00:00Z'); session.endedAt = session.startedAt + 3600000;
    session.exercises.forEach((log, i) => log.sets.forEach(set => Object.assign(set, { weight: log.mode === 'bodyweight' ? 0 : load, reps: session.workout.exercises[i].max, done: true, rir: 3 })));
    if (partial) session.exercises[0].sets[0].done = false;
    store.sessions.push(session); return session;
  }
  const previous = save(1, '2026-10-26', 15); previous.feedback = { before: 'none', after: 'none', nextDay: 'none', nextDayDate: '2026-10-27', technique: true };
  store = reviewWeek(store, 'repeat'); store.programme.attempts[0].ended = '2026-10-30'; currentAttempt(store).started = '2026-10-31';
  save(2, '2026-11-01', 20, true); save(1, '2026-11-02', 17.5);
  store.body = Array.from({ length: 15 }, (_, i) => ({ id: 'body-' + i, date: localDate(new Date(Date.UTC(2026, 9, 19 + i))), kg: 61 + i / 20 }));
  store.recovery = ['2026-10-31', '2026-11-02'].map((date, i) => ({ id: 'recovery-' + i, date, activity: 'walking', cardio: 25 + i * 5, mobility: 10, note: '', week: 5, attemptId: currentAttempt(store).id }));
  return validateStore(store);
}
async function seed(page: Page, store: Store) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(raw => { if (!sessionStorage.getItem('dashboard-seeded')) { localStorage.setItem('gym-hawk-v4', raw); sessionStorage.setItem('dashboard-seeded', 'yes'); } }, JSON.stringify(store));
  await page.goto('/#progress');
}
async function settled(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))); });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('all-time journey and recent lift cards remain visible alongside current attempt context', async ({ page }) => {
  const store = fixture(); await seed(page, store);
  await expect(page.getByRole('heading', { name: 'Since you started' })).toBeVisible();
  await expect(page.locator('.journey-subtitle')).toContainText('26 Oct 2026');
  await expect(page.locator('.journey-stat').nth(0)).toContainText('3');
  await expect(page.locator('.journey-stat').nth(2)).toContainText('2');
  await expect(page.locator('.spotlight-card')).toHaveCount(4);
  await expect(page.locator('.spotlight-card').first()).toContainText('+2.5 kg load across latest 2');
  await expect(page.locator('.spotlight-card').first()).toContainText('2 recorded sessions');
  const attempt = page.getByRole('region', { name: 'Current programme attempt' });
  await expect(attempt).toContainText('Week 5 · Attempt 2'); await expect(attempt).toContainText('1 / 4');
  await expect(attempt).toContainText('55 min cardio'); await expect(page.locator('.pending-feedback')).toContainText('1 workout needs feedback');
  await page.getByRole('tab', { name: /History/ }).click(); await expect(page.locator('.history-row')).toHaveCount(5);
});

test('chart selection supports touch, keyboard and a readable selected set', async ({ page }) => {
  await seed(page, fixture());
  const points = page.locator('.journey-lift [data-point]');
  await expect(points).toHaveCount(2); await points.last().focus(); await page.keyboard.press('Home');
  await expect(points.first()).toBeFocused(); await expect(page.locator('.selected-observation')).toContainText('26 Oct 2026');
  await expect(page.locator('.selected-observation')).toContainText('15 kg × 12 reps');
  await page.keyboard.press('ArrowRight'); await expect(points.last()).toBeFocused();
  await expect(page.locator('.selected-observation')).toContainText('17.5 kg × 12 reps');
  await points.first().click(); await expect(page.locator('.selected-observation')).toContainText('26 Oct 2026');
  await page.getByRole('button', { name: 'Training volume', exact: true }).click();
  await expect(page.getByRole('img', { name: /^Weekly kg × reps/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await expect(page.getByRole('img', { name: /^Weekly sessions/ })).toBeVisible();
});

test('recent tile selects exact movement and muscle distribution keeps the selected attempt', async ({ page }) => {
  const store = fixture(); await seed(page, store);
  const card = recentMovements(movementSeries(store.sessions))[1];
  await page.locator('.spotlight-card').nth(1).click();
  await expect(page.getByLabel('Select exercise for strength chart')).toHaveValue(card.key);
  await expect(page.getByLabel('Insights date range')).toHaveValue('all');
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('button', { name: 'By muscle', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Volume by muscle' })).toBeVisible();
  await expect(page.locator('.muscle-breakdown')).toContainText('attempt started 31 Oct');
});

test('inline bodyweight history, logging, records and recovery feedback use existing v4 data', async ({ page }) => {
  await seed(page, fixture());
  await expect(page.locator('.bodyweight-chart .body-weigh-in')).toHaveCount(15);
  await expect(page.locator('.bodyweight-chart').getByRole('table').getByRole('row')).toHaveCount(16);
  await page.getByRole('button', { name: 'Log bodyweight', exact: true }).click();
  await page.getByLabel('Bodyweight (kg)', { exact: true }).fill('62'); await page.getByRole('button', { name: 'Save bodyweight' }).click();
  await expect(page.locator('.body-chart-latest')).toContainText('62.0 kg');
  await page.locator('.pending-feedback').click(); await page.getByLabel('Following-day symptoms').selectOption('none');
  await page.getByRole('button', { name: 'Save recovery response' }).click(); await expect(page.locator('.pending-feedback')).toHaveCount(0);
  await page.getByRole('button', { name: 'View bodyweight records' }).click(); await expect(page).toHaveURL(/#progress\/bodyweight$/);
});

test('fresh attempts retain full lift history and single weigh-ins never invent a trend', async ({ page }) => {
  const store = fixture(); store.body = [{ id: 'old', date: '2020-01-01', kg: 60 }];
  await seed(page, reviewWeek(store, 'repeat'));
  await expect(page.locator('.spotlight-card')).toHaveCount(4); await expect(page.locator('.journey-stat').first()).toContainText('3');
  await expect(page.locator('.body-chart-latest')).toContainText('1 Jan 2020');
  await expect(page.locator('.bodyweight-chart .body-weigh-in')).toHaveCount(1);
  await expect(page.locator('.bodyweight-chart .body-average-line')).toHaveCount(0);
});

test('full-history chart and latest five use appearances rather than the last five mixed workouts', async ({ page }) => {
  const store = fixture(); const first = structuredClone(store.sessions[0]), lower = structuredClone(store.sessions[1]); store.sessions = [];
  for (let i = 0; i < 7; i++) {
    const session = structuredClone(first); session.id = 'long-' + i; session.date = i === 0 ? '2025-01-01' : `2026-10-${String(i + 1).padStart(2, '0')}`;
    session.startedAt = Date.parse(session.date + 'T10:00:00Z'); session.endedAt = session.startedAt + 60000;
    session.exercises.forEach(log => log.sets.forEach(set => set.weight = log.mode === 'bodyweight' ? 0 : 10 + i * 5)); store.sessions.push(session);
    const mixed = structuredClone(lower); mixed.id = 'lower-' + i; mixed.date = session.date; mixed.startedAt = session.startedAt + 3600000; mixed.endedAt = mixed.startedAt + 60000; store.sessions.push(mixed);
  }
  validateStore(store); await seed(page, store);
  await page.getByLabel('Select exercise for lift journey').selectOption(exerciseKey(first.workout.exercises[0], first.exercises[0].mode));
  await expect(page.locator('.journey-subtitle')).toContainText('1 Jan 2025');
  await expect(page.locator('.journey-lift [data-point]')).toHaveCount(7);
  await expect(page.locator('.journey-comparisons')).toContainText('+30 kg load');
  await expect(page.locator('.journey-comparisons')).toContainText('+20 kg load');
  await expect(page.locator('.spotlight-card').first().locator('.body-weigh-in')).toHaveCount(5);
  expect(await page.locator('.weekly-bar').count()).toBeGreaterThan(90);
});

test('assistance and timed charts agree with exact movement details', async ({ page }) => {
  const store = fixture(), session = newSession(selectedWorkout(store, 4)!, store);
  session.date = '2026-11-02'; session.startedAt = Date.parse('2026-11-02T12:00:00Z'); session.endedAt = session.startedAt + 60000;
  session.exercises.forEach((log, i) => log.sets.forEach(set => Object.assign(set, { done: true, weight: log.mode === 'bodyweight' ? 0 : 20, reps: session.workout.exercises[i].max, rir: 3 })));
  session.exercises[0].sets[0].weight = 10; session.exercises[0].sets[0].reps = 4; store.sessions.push(session);
  validateStore(store); await seed(page, store);
  const assistedKey = exerciseKey(session.workout.exercises[0], session.exercises[0].mode);
  await page.getByLabel('Select exercise for lift journey').selectOption(assistedKey);
  await expect(page.locator('.selected-observation')).toContainText('10 kg assist × 4 reps');
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Machine assistance' })).toBeVisible();
  await expect(page.locator('.chart-point')).toHaveAttribute('title', /10 kg/);
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  const timedIndex = session.workout.exercises.findIndex(ex => ex.timed);
  await page.getByLabel('Select exercise for lift journey').selectOption(exerciseKey(session.workout.exercises[timedIndex], session.exercises[timedIndex].mode));
  await expect(page.locator('.selected-observation')).toContainText('40 sec / side');
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hold time' })).toBeVisible();
  await expect(page.locator('.chart-point')).toHaveAttribute('title', /40 sec/);
});

test('offline reload preserves selected units and all saved history', async ({ page, context }) => {
  const store = fixture(); await seed(page, store);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })); });
  await page.getByLabel('Progress weight unit').selectOption('lb');
  await expect(page.locator('.spotlight-card').first()).toContainText('38.58 lb');
  await context.setOffline(true); await page.reload();
  await expect(page.getByLabel('Progress weight unit')).toHaveValue('lb');
  await expect(page.locator('.bodyweight-chart .body-weigh-in')).toHaveCount(15);
  await expect(page.locator('.journey-lift [data-point]')).toHaveCount(2);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gym-hawk-v4')!));
  expect({ ...stored, settings: store.settings }).toEqual(store);
});

for (const [width, height] of [[320, 568], [390, 844], [768, 1000], [1440, 1000]]) {
  test(`Journey dashboard visual and accessibility review at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One capture matrix per viewport.');
    await page.setViewportSize({ width, height }); const store = fixture(); await seed(page, store);
    const directory = path.resolve('artifacts/progress-journey'); await fs.mkdir(directory, { recursive: true });
    for (const state of ['populated', 'repeat', 'sparse', 'complete', 'empty']) {
      const data = state === 'empty' ? freshStore() : state === 'repeat' ? reviewWeek(structuredClone(store), 'repeat') : structuredClone(store);
      if (state === 'sparse') data.sessions = [data.sessions[0]];
      if (state === 'complete') { currentAttempt(data).ended = '2026-11-02'; currentAttempt(data).decision = 'advance'; data.programme.week = 16; data.programme.attempts.push({ id: 'final', week: 16, started: '2026-11-02', ended: '2026-11-02', decision: 'complete' }); data.programme.status = 'complete'; }
      await page.evaluate(raw => localStorage.setItem('gym-hawk-v4', raw), JSON.stringify(validateStore(data))); await page.reload(); await settled(page); await noOverflow(page);
      if (state === 'sparse') { await expect(page.locator('.journey-comparisons').getByText('—', { exact: true })).toHaveCount(2); await expect(page.locator('.journey-lift [data-point]')).toHaveCount(1); }
      if (state === 'empty') await expect(page.getByRole('heading', { name: 'Start with one session' })).toBeVisible();
      await page.screenshot({ path: path.join(directory, `${state}-${width}.png`), fullPage: true });
      const targets = await page.locator('main button,header button,header select,main select,[role=tab]').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length > 0).map(n => { const b = n.getBoundingClientRect(); return { text: n.textContent, w: b.width, h: b.height }; }));
      expect(targets.filter(t => t.w < 43.5 || t.h < 43.5)).toEqual([]);
    }
    await page.evaluate(raw => localStorage.setItem('gym-hawk-v4', raw), JSON.stringify(store)); await page.reload();
    await page.evaluate(() => document.documentElement.style.fontSize = '20px'); await noOverflow(page);
    const last = page.locator('.distribution-caption'); await last.scrollIntoViewIfNeeded();
    const caption = await last.boundingBox(), dock = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(caption!.y + caption!.height).toBeLessThanOrEqual(dock!.y);
  });
}
