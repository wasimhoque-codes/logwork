import { test, expect, type Page } from '@playwright/test';
import { freshStore, selectedWorkout, newSession, localDate, type Store } from '../../src/model';
import fs from 'node:fs/promises';
import path from 'node:path';

function fixture(active = false, populated = false) {
  const store = freshStore();
  if (populated) {
    store.sessions = Array.from({ length: 5 }, (_, index) => {
      const session = newSession(selectedWorkout(store, 1)!, store);
      session.startedAt = Date.now() - (index + 1) * 86400000;
      session.date = localDate(new Date(session.startedAt));
      session.endedAt = session.startedAt + 1800000;
      session.exercises.forEach(exercise => exercise.sets.forEach(set => Object.assign(set, { weight: exercise.mode === 'bodyweight' ? 0 : 12 + index, done: true, rir: 2 })));
      return session;
    });
    store.body = Array.from({ length: 8 }, (_, index) => ({ id: 'weight-' + index, date: localDate(new Date(Date.now() - (8 - index) * 7 * 86400000)), kg: 70 + index * .2 }));
  }
  if (active) store.active = newSession(selectedWorkout(store, 1)!, store);
  return store;
}
async function seed(page: Page, store: Store) {
  await page.addInitScript(raw => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('gym-hawk-v4', raw); sessionStorage.setItem('seeded', 'yes'); } }, JSON.stringify(store));
}
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' });
const dialog = (page: Page) => page.getByRole('dialog');
const raw = (page: Page) => page.evaluate(() => localStorage.getItem('gym-hawk-v4'));
async function dismiss(page: Page) {
  await dialog(page).getByRole('button', { name: /^(Close dialog|Back to previous screen)$/ }).click();
  await expect(dialog(page)).toHaveCount(0);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('Programme reveals selected days on entry and keyboard navigation only scrolls the strip', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.setFixedTime(new Date('2026-10-30T10:00:00Z'));
  await page.goto('/#programme');
  const strip = page.getByRole('tablist', { name: 'Weekly programme' });
  const friday = strip.getByRole('tab', { name: 'Fri Lower B', exact: true });
  async function selectedVisible() {
    await expect.poll(async () => {
      const outer = await strip.boundingBox(), inner = await strip.locator('[aria-selected=true]').boundingBox();
      return !!outer && !!inner && inner.x >= outer.x - 1 && inner.x + inner.width <= outer.x + outer.width + 1;
    }).toBe(true);
  }
  await expect(friday).toHaveAttribute('aria-selected', 'true');
  await selectedVisible();
  await page.evaluate(() => window.scrollTo(0, 140));
  await friday.evaluate(element => (element as HTMLElement).focus({ preventScroll: true }));
  const scrollY = await page.evaluate(() => window.scrollY);
  await friday.press('End');
  await selectedVisible();
  await expect(strip.getByRole('tab', { name: 'Sun Rest', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await page.keyboard.press('Home'); await selectedVisible();
  await expect(strip.getByRole('tab', { name: 'Mon Upper A', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await noOverflow(page);
});

test('Progress tabs have one tab stop, arrow keys, wrapping and labelled panels', async ({ page }) => {
  await page.goto('/#progress');
  const tabs = page.getByRole('tablist', { name: 'Progress views' });
  const overview = tabs.getByRole('tab', { name: 'Overview' }), history = tabs.getByRole('tab', { name: 'History' });
  await expect(overview).toHaveAttribute('tabindex', '0'); await expect(history).toHaveAttribute('tabindex', '-1');
  await overview.focus(); await page.keyboard.press('ArrowRight');
  await expect(history).toBeFocused(); await expect(history).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'History' })).toBeVisible();
  await page.keyboard.press('ArrowRight'); await expect(overview).toBeFocused();
  await page.keyboard.press('End'); await expect(history).toBeFocused();
  await page.keyboard.press('Home'); await expect(overview).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('tabpanel', { name: 'Overview' })).toBeFocused();
});

test('sheet dismissal keeps focus trapped through exit and restores its trigger', async ({ page }) => {
  await page.goto('/#today');
  const trigger = page.getByRole('button', { name: 'Log bodyweight See your weight trend' });
  await trigger.click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Close dialog', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog(page).getByRole('button', { name: 'Save bodyweight', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  // The dialog retains its focus trap while the short dismissal animation runs.
  expect(await page.evaluate(() => { const panel = document.querySelector('[role=dialog]'); return !panel || panel.contains(document.activeElement); })).toBe(true);
  await expect(dialog(page)).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await trigger.click(); await dismiss(page); await expect(trigger).toBeFocused();
});

test('motion preserves workout inputs, edit drafts, rest and fixed dock position', async ({ page }) => {
  await seed(page, fixture(true, true)); await page.goto('/#workout');
  const input = page.getByLabel('Set 1 weight in kg'); await input.fill('18');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('10');
  const before = await raw(page);
  await page.getByRole('button', { name: /^History for / }).click(); await dismiss(page);
  await expect(input).toHaveValue('18'); expect(await raw(page)).toBe(before);
  await input.evaluate(element => element.setAttribute('data-preserved-input', 'yes'));
  await page.getByRole('button', { name: 'Log set 1', exact: true }).click();
  await expect(page.getByLabel('Set 2 weight in kg')).toHaveAttribute('data-preserved-input', 'yes');
  await page.locator('.logged-sets summary').click(); await page.getByRole('button', { name: 'Edit set 1', exact: true }).click();
  await input.fill('22');
  await page.getByRole('button', { name: 'More exercise options', exact: true }).click(); await dismiss(page);
  await expect(input).toHaveValue('22'); await expect(page.getByRole('button', { name: 'Save set 1', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Rest timer' })).toBeVisible();
  await expect.poll(async () => {
    const box = await page.locator('.workout-dock').boundingBox();
    return Math.abs((box?.y ?? 0) + (box?.height ?? 0) - page.viewportSize()!.height);
  }).toBeLessThanOrEqual(1);
  expect(await page.locator('main').evaluate(element => getComputedStyle(element).transform)).toBe('none');
});

test('reduced motion disables CSS and content animations and dismisses immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, fixture(true)); await page.goto('/#workout');
  await page.getByRole('button', { name: /^History for / }).click();
  expect(await dialog(page).evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.locator('.modal-overlay').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await dismiss(page);
  await page.getByLabel('Set 1 weight in kg').fill('12');
  await page.getByRole('button', { name: 'Log set 1', exact: true }).click();
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.getByRole('button', { name: 'More exercise options' }).click(); await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'More exercise options' })).toBeFocused();
});

test('rapid navigation settles on the final page with no stale overlays or animation state', async ({ page }) => {
  await page.goto('/#today');
  for (const name of ['Programme', 'Progress', 'Today', 'Programme', 'Progress']) await nav(page).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  await expect(nav(page).getByRole('button', { name: 'Progress', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Overview' })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0); await noOverflow(page);
});

for (const [width, height] of [[320, 568], [390, 844], [768, 1000], [1440, 1000]]) {
  test(`visual review and layout clearance at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One capture set per viewport.');
    test.setTimeout(120000);
    const directory = path.resolve('artifacts/sky-blue'); await fs.mkdir(directory, { recursive: true });
    await page.setViewportSize({ width, height });
    await page.clock.setFixedTime(new Date('2026-10-30T10:00:00Z'));
    await seed(page, fixture(true, true));
    const shot = async (name: string) => {
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      await noOverflow(page);
      const undersized = await page.locator('button,a[href],summary').evaluateAll(nodes => nodes.filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && (box.width < 43.5 || box.height < 43.5); }).map(element => element.textContent?.trim() || element.getAttribute('aria-label')));
      expect(undersized, name + ' touch targets').toEqual([]);
      await page.screenshot({ path: path.join(directory, `${name}-${width}.png`) });
    };
    await page.goto('/#today'); await shot('today');
    if (width === 320) {
      const action = await page.getByRole('button', { name: 'Resume Upper A', exact: true }).boundingBox();
      const navigation = await nav(page).boundingBox(); expect(action!.y + action!.height).toBeLessThan(navigation!.y);
    }
    await nav(page).getByRole('button', { name: 'Programme', exact: true }).click(); await shot('programme');
    await nav(page).getByRole('button', { name: 'Progress', exact: true }).click(); await shot('progress');
    await page.getByRole('tab', { name: 'History', exact: true }).click(); await shot('history');
    await page.locator('.history-row').first().click(); await shot('record'); await dismiss(page);
    await page.goto('/#progress/bodyweight'); await shot('chart');
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await page.getByRole('button', { name: 'Open settings' }).click(); await shot('settings');
    await page.goto('/#today'); await page.getByRole('button', { name: 'Log bodyweight See your weight trend' }).click(); await shot('sheet'); await dismiss(page);
    await page.getByRole('button', { name: 'Resume Upper A', exact: true }).click(); await shot('logger');
    const current = page.getByRole('group', { name: 'Current working set' });
    await current.scrollIntoViewIfNeeded();
    const inputs = await page.locator('.set-inputs').boundingBox(), dock = await page.locator('.workout-dock').boundingBox();
    expect(inputs!.y + inputs!.height).toBeLessThanOrEqual(dock!.y + 1);
    await page.getByLabel('Set 1 weight in kg').fill('12'); await page.getByRole('button', { name: 'Log set 1', exact: true }).click(); await shot('rest');
    await page.getByRole('button', { name: /^History for / }).click(); await shot('exercise-history'); await dismiss(page);
    await page.getByRole('button', { name: 'Review and finish workout', exact: true }).click(); await shot('review');
    await page.getByRole('button', { name: 'Save workout', exact: true }).click(); await shot('saved');
    // Empty progress is a separate state, captured after the populated flows.
    await page.evaluate(rawStore => localStorage.setItem('gym-hawk-v4', rawStore), JSON.stringify(freshStore()));
    await page.goto('/#progress'); await page.reload(); await shot('progress-empty');
  });
}
