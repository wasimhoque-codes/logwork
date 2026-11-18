import { test, expect } from './fixture';
import { freshStore, newSession, validateStore } from '../../src/model';
import { fixedWorkoutForDay } from '../../src/data';

test('exercise emblems follow variants, logging, saved details and progress', async ({ page, context }) => {
  const store = freshStore();
  const session = newSession(fixedWorkoutForDay(1, store.programme.options)!, store);
  session.endedAt = session.startedAt + 60000;
  session.exercises.forEach(log => log.sets.forEach(set => Object.assign(set, { done: true, weight: log.mode === 'bodyweight' ? 0 : 12 })));
  store.sessions = [session];
  validateStore(store);
  await page.addInitScript(raw => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('gym-hawk-v4', raw);
      sessionStorage.setItem('seeded', 'yes');
    }
  }, JSON.stringify(store));
  await page.goto('/#programme');
  await page.getByRole('tab', { name: 'Mon Upper A', exact: true }).click();
  const rows = page.locator('.exercise-row');
  await expect(rows.locator('.exercise-emblem')).toHaveCount(7);
  await expect(rows.first().locator('.row-number')).toHaveText('1');
  await rows.filter({ hasText: 'Incline Push-Ups' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Exercise variation').selectOption('p16-feet-pushup');
  await expect(dialog.locator('.exercise-emblem')).toHaveAttribute('data-exercise-icon', 'p16-feet-pushup');
  await dialog.getByRole('button', { name: 'Save exercise choice' }).click();
  await expect(rows.locator('[data-exercise-icon="p16-feet-pushup"]')).toBeVisible();
  await page.getByRole('button', { name: 'Train this session today' }).click();
  await expect(page.locator('.exercise-heading .exercise-emblem')).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('button', { name: /Exercise \d of/ }).click();
  await expect(dialog.locator('.exercise-emblem')).toHaveCount(7);
  await dialog.getByRole('button', { name: /Feet-Elevated Push-Ups/ }).click();
  await expect(page.locator('.exercise-heading .exercise-emblem')).toHaveAttribute('data-exercise-icon', 'p16-feet-pushup');
  await page.getByRole('button', { name: 'Log set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Review and finish workout', exact: true }).click();
  await page.locator('.review-summary summary').click();
  await expect(page.locator('.review-summary .exercise-emblem').first()).toBeVisible();
  await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(dialog.locator('.detail-exercise .exercise-emblem').first()).toBeVisible();
  await dialog.getByRole('button', { name: /^(Close dialog|Back to previous screen)$/ }).click();
  await page.goto('/#progress/exercises');
  await expect(page.locator('.exercise-directory .exercise-emblem').first()).toBeVisible();
  await page.locator('.exercise-directory-row').first().click();
  await expect(page.locator('.app-header h1 .exercise-emblem')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.app-header h1 .exercise-emblem')).toBeVisible();
  await context.setOffline(false);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(page.locator('.app-header h1 .exercise-emblem')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
