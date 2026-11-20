import { workoutResource, expect, test, type Page } from './fixture';
import { fixedWorkoutForDay } from '../../src/data';
import { freshStore, newSession } from '../../src/model';

const monday = new Date('2026-11-16T12:00:00Z');

async function open(page: Page, route: string, populated = false) {
  const store = freshStore();
  if (populated) {
    for (const [date, weight] of [['2026-11-09', 12], ['2026-11-12', 14]] as const) {
      const session = newSession(fixedWorkoutForDay(1, store.programme.options)!, store);
      session.date = date;
      session.startedAt = Date.parse(`${date}T11:00:00Z`);
      session.endedAt = session.startedAt + 3600000;
      for (const exercise of session.exercises) {
        for (const set of exercise.sets) Object.assign(set, { weight: exercise.mode === 'bodyweight' ? 0 : weight, done: true });
      }
      store.sessions.push(session);
    }
  }
  await page.clock.setFixedTime(monday);
  await page.addInitScript(raw => {
    if (sessionStorage.getItem('training-motion-seeded')) return;
    localStorage.setItem('gym-hawk-v4', raw);
    sessionStorage.setItem('training-motion-seeded', 'yes');
  }, JSON.stringify(store));
  await page.goto(`/#${route}`);
}

test('a successful save plays its treatment once and hands off to Today', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, 'today');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByLabel('Set 1 weight in kg').fill('12');
  await page.getByRole('button', { name: 'Log set 1' }).click();
  await expect(page.locator('.set-log-count')).toHaveText('1 logged');
  await expect(page.getByRole('group', { name: 'Rest timer' })).toBeVisible();
  await page.getByRole('button', { name: 'Review and finish workout' }).click();
  await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(page.locator('.saved-mark')).toHaveCSS('animation-name', 'saved-check-in');
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.locator('.today-card')).toHaveAttribute('data-handoff', 'partial');
  await expect(page.locator('.today-check')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.today-card')).toContainText('Partial workout saved');
});

test('technique demos are available on demand with different angles and static poses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'programme');
  await page.getByRole('link', { name: 'Monday Upper A' }).click();
  await page.getByRole('button', { name: /Incline Push-Ups/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('canvas')).toHaveCount(0);
  await dialog.getByText('Watch incline push-up demo', { exact: true }).click();
  const canvas = dialog.locator('canvas');
  await expect(canvas).toHaveAttribute('aria-label', /side view, start position/);
  const start = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await dialog.getByRole('button', { name: 'Show end position' }).click();
  await expect(canvas).toHaveAttribute('aria-label', /side view, end position/);
  expect(await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(start);
  await dialog.getByRole('button', { name: 'Front', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-label', /front view/);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: /Exercise 1 of/ }).click();
  await dialog.getByRole('button', { name: /Incline Push-Ups/ }).click();
  await page.getByRole('button', { name: 'More exercise options' }).click();
  await expect(dialog.getByText('Watch incline push-up demo', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await workoutResource(page,'Warm-up');
  await dialog.getByText('Mobility technique', { exact: true }).click();
  await dialog.getByText('Watch 90/90 hip switches demo', { exact: true }).click();
  await expect(dialog.getByRole('img', { name: /90\/90 hip switches/ })).toBeVisible();
  await dialog.getByText('Watch thoracic open books demo', { exact: true }).click();
  await expect(dialog.getByRole('img', { name: /Thoracic open books/ })).toBeVisible();
});

test('muscle selection changes the figure view and history closes back into the same row', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, 'progress', true);
  await page.getByRole('button', { name: 'Explore training volume', exact: true }).click();
  const rows = page.locator('.muscle-rows');
  await rows.getByRole('button', { name: /^Chest / }).click();
  await expect(page.locator('.muscle-model [role=status]')).toHaveText('Chest · Front view');
  await rows.getByRole('button', { name: /^Back / }).click();
  await expect(page.locator('.muscle-model [role=status]')).toHaveText('Back · Back view');
  await expect(rows.getByRole('button', { name: /^Back / })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/#progress/history');
  await page.addStyleTag({ content: '.page-overlay[data-state=open] > .history-modal-surface { animation-play-state: paused }' });
  const row = page.locator('.history-row').last();
  await row.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await row.click();
  const overlay = page.locator('.history-modal-surface');
  await expect(overlay).toHaveCSS('animation-name', 'history-row-expand');
  expect(await page.evaluate(() => !!document.elementFromPoint(5, 5)?.closest('.page-overlay'))).toBe(true);
  const y = await overlay.evaluate(element => Number.parseFloat((element as HTMLElement).style.getPropertyValue('--history-origin').trim().slice(6)));
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCSS('animation-name', 'history-row-collapse');
  await expect(overlay).toHaveCount(0);
  await expect(row).toBeFocused();
  expect(await row.evaluate(element => element.getBoundingClientRect().top)).toBeCloseTo(y, 0);
});
