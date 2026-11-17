import { expect, test, type Page } from './fixture';

const monday = new Date('2026-11-16T12:00:00Z');
const settled = '[data-art] img';
const moving = '[data-art][data-animating]';

async function openToday(page: Page, date = monday) {
  await page.clock.setFixedTime(date);
  await page.goto('/#today');
  await expect(page.getByRole('region', { name: 'Today’s workout' })).toBeVisible();
}

async function expectPosters(page: Page) {
  await expect(page.locator(moving)).toHaveCount(0);
  await expect(page.locator(settled)).toHaveCount(3);
  await expect.poll(() => page.locator(settled).evaluateAll(
    images => images.every(image => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true);
}

test('Today plays real 3D frames, settles, and respects a reduced-motion change', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openToday(page);
  const hero = page.locator('[data-art="strength"]');
  await expect(hero).toHaveAttribute('data-animating', '', { timeout: 10000 });
  const canvas = hero.locator('canvas');
  const frame = () => canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  const firstFrame = await frame();
  await expect.poll(frame).not.toBe(firstFrame);
  await expect(hero).not.toHaveAttribute('data-animating', '');
  await expect(hero.locator('img')).toBeVisible();

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Programme', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Today', exact: true }).click();
  await expect(hero).toHaveAttribute('data-animating', '', { timeout: 10000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectPosters(page);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Current working set' })).toBeVisible();
});

test('Today uses still artwork when WebGL is unavailable and keeps the card actions usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        if (kind === 'webgl2') {
          document.documentElement.setAttribute('data-webgl-blocked', '');
          return null;
        }
        return Reflect.apply(getContext, this, [kind, ...args]);
      },
    });
  });
  await openToday(page, new Date('2026-11-18T12:00:00Z'));
  await expect(page.locator('html')).toHaveAttribute('data-webgl-blocked', '');
  await expect(page.locator('[data-art="recovery"]')).toBeVisible();
  await expectPosters(page);
  await page.getByRole('button', { name: 'Log bodyweight' }).click();
  await expect(page.getByRole('dialog', { name: 'Log bodyweight' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Log bodyweight' })).toBeFocused();
  await page.getByRole('button', { name: /Your progress 0 workouts logged/i }).click();
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('Today’s still artwork is available after an offline reload', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openToday(page);
  await expectPosters(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
  await expectPosters(page);
  await page.getByRole('button', { name: /View workout history/ }).click();
  await expect(page.getByRole('tab', { name: /History/ })).toHaveAttribute('aria-selected', 'true');
});
