import { test, expect, type Page } from '@playwright/test';
import { freshStore, selectedWorkout, newSession, reviewWeek, currentAttempt, localDate, exerciseKey, validateStore, type Store } from '../../src/model';
import { movementSeries } from '../../src/progress-data';
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

async function openGrid(page: Page) { await page.getByRole('tab', { name: 'Exercises', exact: true }).click(); }
async function openKey(page: Page, key: string) { await page.locator('[data-exercise-key]').evaluateAll((nodes, key) => (nodes.find(n => (n as HTMLElement).dataset.exerciseKey === key) as HTMLButtonElement)?.click(), key); }
test('Overview stays focused and Exercises shows every recorded identity alphabetically', async ({ page }) => {
  const store = fixture(); await seed(page, store);
  await expect(page.locator('.journey-stat').first()).toContainText('3');
  await expect(page.locator('.journey-lift,.spotlight-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Training volume', exact: true }).click(); await expect(page.getByRole('img', { name: /^Weekly kg/ })).toBeVisible();
  await openGrid(page); await expect(page).toHaveURL(/#progress\/exercises$/);
  await expect(page.locator('.exercise-tile')).toHaveCount(movementSeries(store.sessions).length);
  const names = await page.locator('.exercise-tile h3').allTextContents(); expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await expect(page.locator('.exercise-tile .exercise-metrics,.exercise-tile .lift-role,.exercise-tile-footer,.exercise-tile .journey-legend')).toHaveCount(0);
  await expect(page.locator('.exercise-grid-legend')).toHaveCount(1);
  await expect(page.locator('.exercise-tile').first().locator('.exercise-tile-changes dt')).toHaveText(['Since first','Last 1']);
  await expect(page.locator('.exercise-tile p').getByText('Basic', {exact:true})).toHaveCount(0);
  await expect(page.locator('.exercise-tile').first().getByText('Latest set', {exact:true})).toHaveCount(0);
  await expect(page.locator('.exercise-tile').first().locator('svg[role=img]')).toHaveAttribute('height','140');
  await expect(page.locator('.exercise-tile').first().locator('svg [role=button]')).toHaveCount(0);
  await page.getByRole('tab', { name: /History/ }).click(); await expect(page.locator('.history-row')).toHaveCount(5);
});
test('search, role filters, clear and detail return preserve place and focus', async ({ page }) => {
  await seed(page, fixture()); await openGrid(page);
  await page.getByRole('button', { name: 'Main', exact: true }).click(); await page.getByLabel('Search exercises and setups').fill('Basic');
  const trigger = page.getByRole('button', { name: /View details for/ }).last(); await trigger.scrollIntoViewIfNeeded(); const scroll = await page.evaluate(() => scrollY), name = await trigger.getAttribute('aria-label');
  await trigger.click(); await expect(page.locator('.exercise-detail')).toBeVisible(); await expect(page.getByLabel('Select exercise for strength chart')).toHaveCount(0);
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByLabel('Search exercises and setups')).toHaveValue('Basic'); await expect(page.getByRole('button', { name: 'Main', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: name! })).toBeFocused(); await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
  await trigger.click(); await page.goBack(); await expect(page.getByLabel('Search exercises and setups')).toHaveValue('Basic');
  await expect(page.getByRole('button', { name: name! })).toBeFocused();
  await page.getByRole('tab', { name: /History/ }).evaluate(el => (el as HTMLButtonElement).click()); await openGrid(page); await expect(page.getByRole('tab', { name: 'Exercises', exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
  await page.getByLabel('Search exercises and setups').fill('not found'); await expect(page.getByRole('heading', { name: 'No matching exercises' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click(); await expect(page.locator('.exercise-tile')).toHaveCount(14);
});
test('interactive details preserve exact identity on reload and support keyboard point selection', async ({ page }) => {
  const store = fixture(); await seed(page, store); await openGrid(page); const series = movementSeries(store.sessions).find(s => s.records.length === 2)!;
  await openKey(page, series.key); await page.reload(); await expect(page.locator('.exercise-detail-heading h2')).toHaveText(series.exercise.name);
  await expect(page.locator('.exercise-detail .exercise-metrics')).toContainText('First recorded');
  await expect(page.locator('.exercise-detail .exercise-metrics')).toContainText('Peak load');
  const points = page.locator('[data-point]'); await expect(points).toHaveCount(2); await points.last().focus(); await page.keyboard.press('Home'); await expect(points.first()).toBeFocused();
  await expect(page.locator('.selected-observation')).toContainText('26 Oct 2026'); await page.keyboard.press('End'); await expect(page.locator('.selected-observation')).toContainText('2 Nov 2026');
  await page.getByRole('button', { name: 'Browse exercises', exact: true }).click(); await expect(page.locator('.exercise-tile')).toHaveCount(14);
});
test('inline bodyweight, attempt volume and feedback remain available from Overview', async ({ page }) => {
  await seed(page, fixture()); await expect(page.locator('.bodyweight-chart .body-weigh-in')).toHaveCount(15);
  await page.getByRole('button', { name: 'Log bodyweight', exact: true }).click(); await page.getByLabel('Bodyweight (kg)', { exact: true }).fill('62'); await page.getByRole('button', { name: 'Save bodyweight' }).click();
  await expect(page.locator('.body-chart-latest')).toContainText('62.0 kg');
  await page.locator('.pending-feedback').click(); await page.getByLabel('Following-day symptoms').selectOption('none'); await page.getByRole('button', { name: 'Save recovery response' }).click(); await expect(page.locator('.pending-feedback')).toHaveCount(0);
  await page.getByRole('button', { name: 'By muscle', exact: true }).click(); await expect(page.locator('.muscle-breakdown')).toContainText('attempt started 31 Oct');
});
test('old setups and latest-five comparisons survive new attempts and mixed workouts', async ({ page }) => {
  const store = fixture(), first = structuredClone(store.sessions[0]), lower = structuredClone(store.sessions[1]); store.sessions = [];
  for (let i = 0; i < 7; i++) { const s = structuredClone(first); s.id = 'old-' + i; s.date = i === 0 ? '2025-01-01' : `2026-10-0${i + 1}`; s.startedAt = Date.parse(s.date + 'T10:00:00Z'); s.endedAt = s.startedAt + 60000; s.exercises.forEach(log => log.sets.forEach(set => set.weight = log.mode === 'bodyweight' ? 0 : 10 + i * 5)); store.sessions.push(s); const mixed = structuredClone(lower); mixed.id = 'lower-' + i; mixed.date = s.date; mixed.startedAt = s.startedAt + 3600000; mixed.endedAt = mixed.startedAt + 60000; store.sessions.push(mixed); }
  const alternate = structuredClone(first); alternate.id = 'other'; alternate.workout.exercises[0].setup = 'Different bench'; store.sessions.push(alternate);
  await seed(page, validateStore(reviewWeek(store, 'repeat'))); await expect(page.locator('.journey-subtitle')).toContainText('1 Jan 2025'); await openGrid(page);
  await expect(page.locator('.exercise-tile')).toHaveCount(15); await page.getByLabel('Search exercises and setups').fill('Different bench'); await expect(page.locator('.exercise-tile')).toHaveCount(1);
  await expect(page.locator('.exercise-tile-heading p')).toHaveText('Different bench');
  await page.getByLabel('Search exercises and setups').fill(''); await openKey(page, exerciseKey(first.workout.exercises[0], first.exercises[0].mode));
  await expect(page.locator('[data-point]')).toHaveCount(7); await expect(page.locator('.exercise-metrics')).toContainText('+30 kg load'); await expect(page.locator('.exercise-metrics')).toContainText('+20 kg load'); await expect(page.locator('.workload-bars>div')).toHaveCount(5);
});
test('assistance, bodyweight and timed bests retain paired reps and workload units', async ({ page }) => {
  const store = fixture(), session = newSession(selectedWorkout(store, 4)!, store); session.date = '2026-11-02'; session.startedAt = Date.parse('2026-11-02T12:00:00Z'); session.endedAt = session.startedAt + 60000;
  session.exercises.forEach((log, i) => log.sets.forEach(set => Object.assign(set, { done: true, weight: log.mode === 'bodyweight' ? 0 : 20, reps: session.workout.exercises[i].max, rir: 3 }))); session.exercises[0].sets[0].weight = 10; session.exercises[0].sets[0].reps = 4; store.sessions.push(session);
  await seed(page, validateStore(store)); await openGrid(page); await openKey(page, exerciseKey(session.workout.exercises[0], session.exercises[0].mode));
  await expect(page.locator('.selected-observation')).toContainText('10 kg assist × 4 reps'); await expect(page.locator('.exercise-metrics')).toContainText('Least assistance'); await expect(page.locator('.workload-unit')).toHaveText('logged sets');
  await page.getByRole('button', { name: 'Go back', exact: true }).click(); const index = session.workout.exercises.findIndex(ex => ex.timed); await openKey(page, exerciseKey(session.workout.exercises[index], session.exercises[index].mode));
  await expect(page.locator('.selected-observation')).toContainText('40 sec / side'); await expect(page.locator('.exercise-metrics')).toContainText('Longest hold');
});
test('offline reload preserves units, recorded identities and storage', async ({ page, context }) => {
  const store = fixture(); await seed(page, store); await openGrid(page); await page.getByLabel('Progress weight unit').selectOption('lb');
  await expect(page.locator('.exercise-tile').filter({ hasText: 'Chest-Supported Machine Row' })).toContainText('38.58 lb');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })); });
  await context.setOffline(true); await page.reload(); await expect(page.locator('.exercise-tile')).toHaveCount(14); await expect(page.getByLabel('Progress weight unit')).toHaveValue('lb');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gym-hawk-v4')!)); expect({ ...stored, settings: store.settings }).toEqual(store);
});
for (const [width, height] of [[320, 568], [390, 844], [768, 1000], [1440, 1000]]) {
  test(`exercise grid visual and accessibility review at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One capture matrix per viewport.'); await page.setViewportSize({ width, height }); const store = fixture(); await seed(page, store); await openGrid(page);
    const directory = path.resolve('artifacts/exercise-grid'); await fs.mkdir(directory, { recursive: true });
    for (const state of ['populated', 'sparse', 'empty']) { const data = state === 'empty' ? freshStore() : structuredClone(store); if (state === 'sparse') data.sessions = [data.sessions[0]];
      await page.evaluate(raw => localStorage.setItem('gym-hawk-v4', raw), JSON.stringify(data)); await page.reload(); await settled(page); await noOverflow(page);
      if (state === 'sparse') await expect(page.locator('.exercise-tile').first().getByText('—', { exact: true })).toHaveCount(2);
      if (state === 'empty') await expect(page.getByRole('heading', { name: 'Your exercise progress starts here' })).toBeVisible();
      await page.screenshot({ path: path.join(directory, `${state}-${width}.png`), fullPage: true });
      if (state === 'populated') {
        const tiles = await page.locator('.exercise-tile').evaluateAll(nodes => nodes.map(n => ({ name: n.querySelector('h3')?.textContent, height: n.getBoundingClientRect().height })));
        await fs.writeFile(path.join(directory, `heights-${width}.json`), JSON.stringify(tiles));
        if (width <= 390) expect(Math.max(...tiles.map(t => t.height))).toBeLessThanOrEqual(380);
        if (width === 390) expect(tiles.reduce((sum, tile) => sum + tile.height, 0) / tiles.length).toBeLessThanOrEqual(340);
      }
      const targets = await page.locator('main button,header button,header select,[role=tab]').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length > 0).map(n => { const b = n.getBoundingClientRect(); return { text: n.textContent, w: b.width, h: b.height }; })); expect(targets.filter(t => t.w < 43.5 || t.h < 43.5)).toEqual([]);
    }
    await page.evaluate(raw => localStorage.setItem('gym-hawk-v4', raw), JSON.stringify(store)); await page.reload(); await page.getByRole('button', { name: /View details for/ }).first().click(); await settled(page); await noOverflow(page); await page.screenshot({ path: path.join(directory, `detail-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Go back', exact: true }).click(); await page.evaluate(() => document.documentElement.style.fontSize = '20px'); await noOverflow(page);
    const last = page.locator('.comparison-help summary'); await last.scrollIntoViewIfNeeded(); const caption = await last.boundingBox(), dock = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox(); expect(caption!.y + caption!.height).toBeLessThanOrEqual(dock!.y);
  });
}
