import { test, expect, type Page } from '@playwright/test';
import { freshStore, fromKg, localDate, type Store } from '../../src/model';
import fs from 'node:fs/promises';
import path from 'node:path';

function fixture() {
  const store = freshStore();
  store.body = [70, 70.4, 70.1, 70.3, 70.6].map((kg, index) => ({ id: 'body-' + index, date: `2026-10-${26 + index}`, kg }));
  return store;
}
async function seed(page: Page, store: Store) {
  await page.clock.setFixedTime(new Date('2026-10-30T10:00:00Z'));
  await page.addInitScript(raw => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('gym-hawk-v4', raw); sessionStorage.setItem('seeded', 'yes'); } }, JSON.stringify(store));
}
const chart = (page: Page) => page.locator('.bodyweight-chart');
const data = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('gym-hawk-v4')!) as Store);
async function settled(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))); });
}

test('both Progress charts retain every weigh-in within one week, with rolling averages and no chart controls', async ({ page }) => {
  const store = fixture(); await seed(page, store);
  for (const route of ['progress', 'progress/bodyweight']) {
    await page.goto('/#' + route);
    await expect(chart(page).locator('.body-weigh-in')).toHaveCount(5);
    await expect(chart(page).locator('.body-average-line')).toHaveCount(1);
    await expect(chart(page).locator('.body-chart-latest')).toContainText('70.6 kg');
    await expect(chart(page).locator('.body-chart-stats')).toContainText('70.3 kg');
    await expect(chart(page).locator('.body-chart-stats')).toContainText('+0.6 kg');
    await expect(chart(page).getByRole('table').getByRole('row')).toHaveCount(6);
    await expect(chart(page).locator('button,select,[role=slider],[role=tooltip],svg title')).toHaveCount(0);
    await expect(page.getByRole('img', { name: /^Bodyweight trend/ })).toBeVisible();
  }
  await expect(page.getByLabel('Insights date range')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Weekly bodyweight summaries' }).locator('div')).toHaveCount(1);
  expect((await data(page)).body).toEqual(store.body);
});

test('old readings remain visible and irregular dates use real time spacing', async ({ page }) => {
  const store = fixture(); store.body = [
    { id: 'old', date: '2020-01-01', kg: 62 },
    { id: 'middle', date: '2020-01-03', kg: 63 },
    { id: 'recent', date: '2026-10-30', kg: 70 },
  ];
  await seed(page, store); await page.goto('/#progress/bodyweight'); await settled(page);
  await expect(chart(page).locator('.body-weigh-in')).toHaveCount(3);
  await expect(chart(page).locator('.body-chart-caption')).toContainText('1 Jan 2020');
  const xs = await chart(page).locator('.body-weigh-in').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('cx'))));
  expect((xs[1] - xs[0]) / (xs[2] - xs[0])).toBeLessThan(.01);
  await expect(chart(page).locator('.body-chart-stats')).toContainText('1 reading in 7 days');
});

test('single and empty states show honest data and logging prompts', async ({ page }) => {
  const store = fixture(); store.body = [store.body.at(-1)!];
  await seed(page, store); await page.goto('/#progress/bodyweight');
  await expect(chart(page).locator('.body-weigh-in')).toHaveCount(1);
  await expect(chart(page).locator('.body-average-line')).toHaveCount(0);
  await expect(chart(page)).toContainText('Log another day');
  await expect(chart(page).locator('.body-chart-stats')).toContainText('—');
  await page.getByRole('button', { name: 'Delete bodyweight for 2026-10-30', exact: true }).click();
  await page.getByRole('button', { name: 'Delete entry', exact: true }).click();
  await expect(page.locator('.body-chart-empty')).toContainText('Log your first weigh-in');
  await expect(page.locator('.body-weigh-in')).toHaveCount(0);
  await page.goto('/#progress');
  await page.locator('.body-trend').getByRole('button', { name: 'Log bodyweight', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Log bodyweight', exact: true })).toBeVisible();
});

test('replacement, deletion, offline reload, units and backups preserve chart data', async ({ page, context }) => {
  const store = fixture(); await seed(page, store); await page.goto('/#progress/bodyweight');
  await page.getByRole('button', { name: 'Log bodyweight', exact: true }).click();
  await page.getByLabel('Bodyweight (kg)', { exact: true }).fill('71.2');
  await page.getByRole('button', { name: 'Save bodyweight', exact: true }).click();
  await expect(chart(page).locator('.body-weigh-in')).toHaveCount(5);
  await expect(chart(page).locator('.body-chart-latest')).toContainText('71.2 kg');
  const saved = await data(page); expect(saved.body).toHaveLength(5);
  await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); await page.reload();
  await expect(chart(page).locator('.body-chart-latest')).toContainText('71.2 kg');
  await context.setOffline(false); await page.goto('/#settings');
  await page.getByRole('button', { name: 'lb', exact: true }).click(); await page.goto('/#progress/bodyweight');
  await expect(chart(page).locator('.body-chart-latest')).toContainText(fromKg(71.2, 'lb').toFixed(1) + ' lb');
  await page.goto('/#settings');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const backup = JSON.parse(await fs.readFile((await (await download).path())!, 'utf8')) as Store;
  expect(backup.body).toEqual(saved.body); expect(backup.version).toBe(4);
  await page.getByLabel('Import backup file').setInputFiles({ name: 'bodyweight.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(store)) });
  await page.getByRole('button', { name: 'Replace data and restore', exact: true }).click();
  await page.goto('/#progress/bodyweight'); await expect(chart(page).locator('.body-chart-latest')).toContainText('70.6 kg');
  await page.getByRole('button', { name: 'Delete bodyweight for 2026-10-30', exact: true }).click(); await page.getByRole('button', { name: 'Delete entry', exact: true }).click();
  await expect(chart(page).locator('.body-weigh-in')).toHaveCount(4); await expect(chart(page).locator('.body-chart-latest')).toContainText('70.3 kg');
  await page.goto('/#progress'); await expect(chart(page).locator('.body-weigh-in')).toHaveCount(4);
});

test('sky-blue controls, hero text and chart marks retain readable contrast', async ({ page }) => {
  await seed(page, fixture()); await page.goto('/#today'); await settled(page);
  async function contrast(selector: string, svg = false) {
    return page.locator(selector).first().evaluate((element, svg) => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
      let background = [255, 255, 255], ancestors: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) ancestors.push(node);
      for (const node of ancestors.reverse()) {
        const color = rgb(getComputedStyle(node).backgroundColor), alpha = color[3] ?? 1;
        background = background.map((channel, index) => color[index] * alpha + channel * (1 - alpha));
      }
      const foreground = rgb(svg ? getComputedStyle(element).fill : getComputedStyle(element).color);
      const luminance = (channels: number[]) => channels.slice(0, 3).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
      const a = luminance(background), b = luminance(foreground); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    }, svg);
  }
  for (const selector of ['.today-card h2', '.today-card .workout-meta', '.today-card .badge', '.hero-button']) expect(await contrast(selector), selector).toBeGreaterThanOrEqual(4.5);
  expect(await page.locator('.today-card').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(102, 199, 244)');
  await page.goto('/#progress/bodyweight'); await settled(page);
  for (const selector of ['.body-chart-label', '.body-chart-legend', '.body-chart-caption']) expect(await contrast(selector), selector).toBeGreaterThanOrEqual(4.5);
  expect(await contrast('.body-weigh-in', true)).toBeGreaterThanOrEqual(3);
  expect(await page.locator('.body-average-line').evaluate(element => getComputedStyle(element).stroke)).toBe('rgb(108, 110, 160)');
});

for (const [width, height] of [[320, 568], [390, 844], [768, 1000], [1440, 1000]]) {
  test(`bodyweight visual review at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One capture set per viewport.');
    await page.setViewportSize({ width, height });
    const store = fixture(); store.body = Array.from({ length: 35 }, (_, index) => ({ id: 'weight-' + index, date: localDate(new Date(Date.UTC(2026, 8, 26 + index))), kg: Math.round((69.5 + index * .025 + [0, .18, -.12, .09, -.08][index % 5]) * 100) / 100 }));
    await seed(page, store); await page.goto('/#progress'); await settled(page);
    const directory = path.resolve('artifacts/sky-blue'); await fs.mkdir(directory, { recursive: true });
    await page.locator('.body-trend').screenshot({ path: path.join(directory, `bodyweight-overview-${width}.png`), style: '.bottom-nav{visibility:hidden}' });
    await page.goto('/#progress/bodyweight'); await settled(page);
    await page.screenshot({ path: path.join(directory, `bodyweight-detail-${width}.png`) });
    await page.locator('.bodyweight-panel').screenshot({ path: path.join(directory, `bodyweight-chart-${width}.png`), style: '.bottom-nav{visibility:hidden}' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const chartBounds = await chart(page).boundingBox();
    const tickBounds = await chart(page).locator('svg text').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right }; }));
    expect(tickBounds.every(box => box.left >= chartBounds!.x - 1 && box.right <= chartBounds!.x + chartBounds!.width + 1)).toBe(true);
  });
}
