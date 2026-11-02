import { test, expect, type Page } from '@playwright/test';
import { freshStore, selectedWorkout, newSession, reviewWeek, currentAttempt, localDate, exerciseKey, validateStore, type Store } from '../../src/model';
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

test('dashboard separates attempt completion, seven-day recovery and history log counts', async ({ page }) => {
  await seed(page, fixture());
  const attempt = page.getByRole('region', { name: 'Current programme attempt' });
  await expect(attempt).toContainText('Week 5 · Attempt 2'); await expect(attempt).toContainText('Repeat');
  await expect(attempt).toContainText('1 / 4'); await expect(attempt).toContainText('2 recovery days logged'); await expect(attempt).toContainText('55 min cardio');
  await expect(page.locator('.attempt-workouts .complete')).toContainText('Upper A'); await expect(page.locator('.attempt-workouts .partial')).toContainText('Lower A');
  await expect(page.getByRole('tab', { name: /History.*5 logs/ })).toBeVisible();
  await expect(page.locator('.spotlight-context')).toContainText('2 Nov vs 26 Oct · previous attempt');
  await expect(page.locator('.spotlight-card')).toHaveCount(4); await expect(page.locator('.spotlight-card').first()).toContainText('+2.5 kg load');
  await expect(page.locator('.spotlight-card').first()).toContainText('Load PR'); await expect(page.locator('.spotlight-card').first()).toContainText('3 logged sets vs 3');
  await expect(page.locator('.recovery-snapshot')).toContainText('2 recovery logs');
  await expect(page.locator('.pending-feedback')).toContainText('1 workout needs feedback');
  await page.getByRole('tab', { name: /History/ }).click(); await expect(page.locator('.history-row')).toHaveCount(5);
});

test('spotlight opens the exact exercise and muscle distribution opens the selected attempt', async ({ page }) => {
  const store = fixture(); await seed(page, store);
  const row = page.locator('.spotlight-card').nth(1); const key = exerciseKey(store.sessions.at(-1)!.workout.exercises[1], store.sessions.at(-1)!.exercises[1].mode);
  await row.click(); await expect(page).toHaveURL(/#progress\/movement$/); await expect(page.getByLabel('Select exercise for strength chart')).toHaveValue(key);
  await expect(page.getByLabel('Insights date range')).toHaveValue('all');
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('button', { name: 'By muscle', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Volume by muscle' })).toBeVisible(); await expect(page.locator('.muscle-breakdown')).toContainText('attempt started 31 Oct');
  await expect(page.getByLabel('Insights date range')).toHaveCount(0);
  await page.getByRole('button', { name: 'Weekly trend' }).click(); await expect(page.getByRole('heading', { name: 'Volume · kg × reps' })).toBeVisible();
  await page.goto('/#today'); await page.goto('/#progress/volume');
  await expect(page.getByRole('heading', { name: 'Volume · kg × reps' })).toBeVisible();
});

test('full-history overlay traps focus, preserves the overview scroll and opens bodyweight records', async ({ page }) => {
  await seed(page, fixture());
  const trigger = page.getByRole('button', { name: 'Open full bodyweight chart' }); await trigger.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY); await trigger.click();
  const overlay = page.getByRole('dialog', { name: 'Bodyweight trend', exact: true });
  await expect(overlay.locator('.body-weigh-in')).toHaveCount(15);
  await expect(overlay.getByRole('table').getByRole('row')).toHaveCount(16);
  await expect(overlay.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(overlay.getByRole('button', { name: 'View bodyweight records' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(overlay.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(overlay).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
  await trigger.click(); await overlay.getByRole('button', { name: 'View bodyweight records' }).click();
  await expect(page).toHaveURL(/#progress\/bodyweight$/); await expect(page.locator('.bodyweight-chart .body-weigh-in')).toHaveCount(15);
});

test('snapshot logging, unit persistence and feedback use existing v4 records', async ({ page }) => {
  const store = fixture(); await seed(page, store);
  await page.getByLabel('Progress weight unit').selectOption('lb');
  await expect(page.locator('.spotlight-card').first()).toContainText('38.58 lb');
  await page.reload(); await expect(page.getByLabel('Progress weight unit')).toHaveValue('lb');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gym-hawk-v4')!));
  expect({ ...stored, settings: store.settings }).toEqual(store);
  await page.getByLabel('Progress weight unit').selectOption('kg');
  await page.locator('.body-trend').getByRole('button', { name: 'Log bodyweight', exact: true }).click();
  await page.getByLabel('Bodyweight (kg)', { exact: true }).fill('62'); await page.getByRole('button', { name: 'Save bodyweight' }).click();
  await expect(page.locator('.body-snapshot-button')).toContainText('62 kg');
  await page.locator('.pending-feedback').click(); await page.getByLabel('Following-day symptoms').selectOption('none');
  await page.getByRole('button', { name: 'Save recovery response' }).click(); await expect(page.locator('.pending-feedback')).toHaveCount(0);
});

test('stale and single weigh-ins stay honest and fresh attempts have no comparison results', async ({ page }) => {
  const store = fixture(); store.body = [{ id: 'old', date: '2020-01-01', kg: 60 }];
  const next = reviewWeek(store, 'repeat'); await seed(page, next);
  await expect(page.getByRole('heading', { name: 'A fresh attempt starts here' })).toBeVisible(); await expect(page.locator('.spotlight-card')).toHaveCount(0);
  await expect(page.locator('.body-snapshot-button')).toContainText('1 Jan 2020'); await expect(page.locator('.body-snapshot-average')).toContainText('—');
  await expect(page.locator('.weight-sparkline')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open full bodyweight chart' }).click(); await expect(page.locator('.bodyweight-chart .body-weigh-in')).toHaveCount(1); await expect(page.locator('.body-average-line')).toHaveCount(0);
});

test('dashboard and full-history overlay remain available offline after reload', async ({ page, context }) => {
  await seed(page, fixture());
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true); await page.reload();
  await expect(page.locator('.spotlight-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Open full bodyweight chart' }).click();
  await expect(page.getByRole('dialog').locator('.body-weigh-in')).toHaveCount(15);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Progress weight unit').selectOption('lb'); await page.reload();
  await expect(page.getByLabel('Progress weight unit')).toHaveValue('lb'); await expect(page.locator('.spotlight-card').first()).toContainText('38.58 lb');
});

for (const [width, height] of [[320, 568], [390, 844], [768, 1000], [1440, 1000]]) {
  test(`Progress dashboard visual and accessibility review at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One capture matrix per viewport.');
    await page.setViewportSize({ width, height }); const store = fixture(); await seed(page, store);
    const directory = path.resolve('artifacts/progress-dashboard'); await fs.mkdir(directory, { recursive: true });
    for (const state of ['repeat', 'populated', 'complete', 'empty']) {
      const data = state === 'empty' ? freshStore() : structuredClone(store);
      if (state === 'populated') { data.programme.attempts[0].decision = 'advance'; data.programme.attempts[0].week = 4; data.sessions[0].week = 4; }
      if (state === 'complete') {
        currentAttempt(data).ended = '2026-11-02'; currentAttempt(data).decision = 'advance';
        data.programme.week = 16; data.programme.attempts.push({ id: 'final-attempt', week: 16, started: '2026-11-02', ended: '2026-11-02', decision: 'complete' });
        data.programme.status = 'complete';
      }
      validateStore(data);
      await page.evaluate(raw => localStorage.setItem('gym-hawk-v4', raw), JSON.stringify(data)); await page.reload(); await settled(page);
      await noOverflow(page);
      if (state === 'complete') await expect(page.locator('.attempt-status')).toHaveText('Block complete');
      if (state === 'empty') await expect(page.getByRole('heading', { name: 'Start with one session' })).toBeVisible();
      await page.screenshot({ path: path.join(directory, `${state}-${width}.png`), fullPage: true });
      const targets = await page.locator('main button,header button,header select,[role=tab]').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length > 0).map(n => { const b = n.getBoundingClientRect(); return { text: n.textContent, w: b.width, h: b.height }; }));
      expect(targets.filter(t => t.w < 43.5 || t.h < 43.5)).toEqual([]);
    }
    await page.evaluate(raw => localStorage.setItem('gym-hawk-v4', raw), JSON.stringify(store)); await page.reload();
    await page.getByRole('button', { name: 'Open full bodyweight chart' }).click(); await settled(page); await noOverflow(page);
    await page.screenshot({ path: path.join(directory, `overlay-${width}.png`) });
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'By muscle', exact: true }).click(); await settled(page); await noOverflow(page);
    await page.screenshot({ path: path.join(directory, `muscles-${width}.png`), fullPage: true });
    await page.goto('/#progress'); await page.evaluate(() => document.documentElement.style.fontSize = '20px'); await noOverflow(page);
    const last = page.locator('.distribution-caption'); await last.scrollIntoViewIfNeeded();
    const caption = await last.boundingBox(), dock = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(caption!.y + caption!.height).toBeLessThanOrEqual(dock!.y);
  });
}
