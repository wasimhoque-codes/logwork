import type { Locator } from '@playwright/test';
import { setAction, test, expect, type Page } from './fixture';
import { freshStore, newSession, selectedWorkout } from '../../src/model';

test.use({ viewport: { width: 390, height: 700 } });

test('Programme exercise fields and save action clear the keyboard within their sheet', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const keyboard=await simulateKeyboard(page);
  await page.goto('/#programme/monday');
  const trigger=page.getByRole('button',{name:/Incline Push-Ups/});
  await trigger.click();
  const field=page.getByLabel('Support height in cm');
  await field.fill('45');
  await keyboard(350);
  const save=page.getByRole('button',{name:'Save exercise choice'});
  await expect.poll(()=>field.evaluate(input=>{
    const bounds=input.getBoundingClientRect();
    const sheet=input.closest('.programme-sheet')!;
    const top=sheet.querySelector('.modal-heading')!.getBoundingClientRect().bottom;
    const bottom=sheet.querySelector('.programme-sheet-footer')!.getBoundingClientRect().top;
    return bounds.top>=top&&bounds.bottom<=bottom;
  })).toBe(true);
  expect(await save.evaluate(button=>button.getBoundingClientRect().bottom)).toBeLessThanOrEqual(350);
  await field.fill('301');await expect(save).toBeDisabled();
  await field.fill('45');await expect(save).toBeEnabled();
  await keyboard(700);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel('Support height in cm')).toHaveValue('');
  await page.getByRole('button',{name:'Close dialog',exact:true}).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(save).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Close dialog',exact:true})).toBeFocused();
});

async function simulateKeyboard(page: Page) {
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    let occlusion = 0;
    let pan = 0;
    Object.defineProperties(viewport, {
      height: { get: () => window.innerHeight - occlusion },
      offsetTop: { get: () => pan },
      scale: { value: 1 },
    });
    Object.defineProperty(window, 'visualViewport', { value: viewport });
    window.addEventListener('test-keyboard', event => {
      const { covered, top } = (event as CustomEvent<{ covered: number; top: number }>).detail;
      const resized = occlusion !== covered;
      const panned = pan !== top;
      occlusion = covered;
      pan = top;
      if (resized) viewport.dispatchEvent(new Event('resize'));
      if (panned) viewport.dispatchEvent(new Event('scroll'));
    });
  });

  return (visibleHeight: number, top = 0) => page.evaluate(({ visibleHeight, top }) => {
    window.dispatchEvent(new CustomEvent('test-keyboard', {
      detail: { covered: Math.max(0, window.innerHeight - visibleHeight), top },
    }));
  }, { visibleHeight, top });
}

async function focus(field: Locator) {
  await field.evaluate(input => input.focus({ preventScroll: true }));
  await expect(field).toBeFocused();
}

async function expectClear(field: Locator, boundary: 'dock' | 'history' | 'viewport') {
  await expect.poll(() => field.evaluate((input, boundary) => {
    const viewport = window.visualViewport!;
    const rect = input.getBoundingClientRect();
    const dock = document.querySelector('.workout-dock');
    const header = input.closest('.modal-page')?.querySelector('.modal-heading');
    const top = boundary === 'history' ? Math.max(viewport.offsetTop, header!.getBoundingClientRect().bottom) : viewport.offsetTop;
    const bottom = boundary === 'dock' ? dock!.getBoundingClientRect().top : viewport.offsetTop + viewport.height;
    return rect.top >= top && rect.bottom <= bottom;
  }, boundary)).toBe(true);
}

test('active set fields clear the keyboard and rest dock after focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const keyboard = await simulateKeyboard(page);
  await page.goto('/#programme');
  await page.getByRole('link', { name: 'Monday Upper A', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByLabel('Set 1 weight in kg').fill('12');
  await page.getByRole('button', { name: 'Log set 1', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Rest timer' })).toBeVisible();

  const weight = page.getByLabel('Set 2 weight in kg');
  const reps = page.getByLabel('Set 2 reps');
  const dock = page.locator('.workout-dock');
  await focus(weight);
  await expectClear(weight, 'dock');
  const initialBottom = await weight.evaluate(input => input.getBoundingClientRect().bottom);
  await keyboard(350);
  await expectClear(weight, 'dock');
  expect(await weight.evaluate(input => input.getBoundingClientRect().bottom)).toBeLessThan(initialBottom);
  await focus(reps);
  await expectClear(reps, 'dock');

  await keyboard(160);
  await expect(dock).toHaveCSS('position', 'static');
  await expectClear(reps, 'viewport');
  await keyboard(700);
  await expect(dock).toHaveCSS('position', 'fixed');
  await expect(reps).toBeFocused();

  await page.getByRole('button', { name: 'Log set 2', exact: true }).click();
  await setAction(page,1,'Edit');
  const editedWeight = page.getByLabel('Set 1 weight in kg');
  await focus(editedWeight);
  await keyboard(350);
  await expectClear(editedWeight, 'dock');
  await expect(editedWeight).toBeFocused();
});

test('History scrolls only the editor as the visual viewport shrinks and pans', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const keyboard = await simulateKeyboard(page);
  const store = freshStore();
  const session = newSession(selectedWorkout(store, 1)!, store);
  session.endedAt = session.startedAt + 60_000;
  Object.assign(session.exercises[0].sets[0], { weight: 12, done: true });
  store.sessions = [session];
  await page.addInitScript(value => localStorage.setItem('gym-hawk-v4', value), JSON.stringify(store));
  await page.goto('/#progress/history');
  await page.locator('.history-row').first().click();
  await page.getByRole('button', { name: 'Edit workout', exact: true }).click();

  const pageScroll = await page.evaluate(() => window.scrollY);
  const dialog = page.getByRole('dialog');
  const weight = dialog.getByLabel(session.exercises[0].name + ' set 1 weight', { exact: true });
  const reps = dialog.getByLabel(session.exercises[1].name + ' set 2 reps', { exact: true });
  await focus(weight);
  await expectClear(weight, 'history');
  const initialBottom = await weight.evaluate(input => input.getBoundingClientRect().bottom);
  await keyboard(260, 40);
  await expectClear(weight, 'history');
  expect(await weight.evaluate(input => input.getBoundingClientRect().bottom)).toBeLessThan(initialBottom);
  await focus(reps);
  await expectClear(reps, 'history');
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);

  await keyboard(700);
  await expect(dialog).toHaveCSS('height', '700px');
  await expect(reps).toBeFocused();
});
