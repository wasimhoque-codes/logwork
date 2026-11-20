import { test, expect, replaceLocal, type Page } from './fixture';
import { freshStore, selectedWorkout, newSession, localDate, type Store } from '../../src/model';
import { featuredMovements, movementSeries } from '../../src/progress-data';

function fixture() {
  const store = freshStore();
  for (let i = 0; i < 12; i++) {
    const session = newSession(selectedWorkout(store, i % 2 ? 2 : 1)!, store);
    session.date = localDate(new Date(Date.UTC(2026, 10, 2 + i)));
    session.startedAt = Date.parse(session.date + 'T10:00:00Z'); session.endedAt = session.startedAt + 3300000;
    session.exercises.forEach(log => log.sets.forEach(set => Object.assign(set, { done:true, weight:log.mode === 'bodyweight' ? 0 : 20 + Math.floor(i / 4) * 2.5, reps:8 + i % 2, rir:2 })));
    store.sessions.push(session);
  }
  store.body = Array.from({length:18}, (_, i) => ({id:`weigh-${i}`, date:localDate(new Date(Date.UTC(2026, 10, 1 + i))), kg:70 + Math.round((i * .04 + [0, .2, -.1][i % 3]) * 10) / 10}));
  return store;
}
async function seed(page: Page, store: Store) {
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(raw => { if (!sessionStorage.getItem('progress-redesign-seeded')) { localStorage.setItem('gym-hawk-v4', raw); sessionStorage.setItem('progress-redesign-seeded','yes'); } }, JSON.stringify(store));
  await page.goto('/#progress');
  await expect(page.getByRole('heading', {name:'Your lifts',exact:true})).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (await page.evaluate(() => innerWidth <= 760 && document.querySelector('.app-content')?.getAttribute('data-dock') === 'true')) {
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  }
}

for (const width of [320, 390, 768, 1440]) {
  test(`redesigned Progress screens at ${width}px`, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One viewport matrix.');
    await page.setViewportSize({width, height:width <= 390 ? 844 : 1000});
    const store = fixture(); await seed(page, store);
    const lifts = featuredMovements(movementSeries(store.sessions));
    await expect(page.locator('.featured-lift')).toHaveCount(4);
    await expect(page.locator('.featured-lift-heading strong')).toHaveText(lifts.map(series => series.exercise.name));
    await noOverflow(page);
    await page.screenshot({path:`artifacts/progress-redesign/overview-${width}.png`,fullPage:true});
    await page.locator('.progress-support-grid').screenshot({path:`artifacts/progress-redesign/support-${width}.png`});
    const featured = page.locator('.featured-lift').first();
    await featured.click();
    await expect(page.locator('.exercise-detail')).toBeVisible();
    await page.getByRole('button', {name:'Go back',exact:true}).click();
    await expect(featured).toBeFocused();
    await page.getByRole('tab', {name:'Exercises',exact:true}).click();
    await expect(page.locator('.exercise-tile')).toHaveCount(movementSeries(store.sessions).length);
    await page.getByRole('button', {name:'Filters',exact:true}).click();
    await page.getByLabel('Exercise role', {exact:true}).selectOption('main');
    await page.getByRole('button', {name:'Apply filters',exact:true}).click();
    await expect(page.getByRole('button', {name:'Remove role filter main'})).toBeVisible();
    await page.screenshot({path:`artifacts/progress-redesign/exercises-${width}.png`,fullPage:true});
    const trigger = page.getByRole('button', {name:/View details for/}).first();
    await trigger.click();
    await expect(page.getByRole('heading', {name:'Your benchmarks'})).toBeVisible();
    await noOverflow(page);
    await page.screenshot({path:`artifacts/progress-redesign/lift-${width}.png`,fullPage:true});
    await page.getByRole('button', {name:'Go back',exact:true}).click();
    await expect(trigger).toBeFocused();
    await page.getByRole('tab', {name:'History',exact:true}).click();
    await expect(page.locator('.history-row')).toHaveCount(store.sessions.length);
    await page.screenshot({path:`artifacts/progress-redesign/history-${width}.png`,fullPage:true});
    await page.locator('.history-row').first().click();
    await expect(page.locator('.saved-workout-stats')).toContainText('Logged sets');
    await page.screenshot({path:`artifacts/progress-redesign/workout-${width}.png`,fullPage:true});
    await page.getByRole('button', {name:'Back to previous screen'}).click();
    await page.getByRole('tab', {name:'Overview',exact:true}).click();
    await page.getByRole('button', {name:'Explore training volume',exact:true}).click();
    await expect(page.getByRole('button', {name:'By muscle',exact:true})).toHaveAttribute('aria-pressed','true');
    await noOverflow(page);
    await page.screenshot({path:`artifacts/progress-redesign/volume-${width}.png`,fullPage:true});
    await page.getByRole('button', {name:'Go back',exact:true}).click();
    await page.getByRole('button', {name:'View trend',exact:true}).click();
    await expect(page.locator('.body-weigh-in')).toHaveCount(store.body.length);
    await expect(page.locator('.body-weekly-summaries')).not.toHaveAttribute('open', '');
    await noOverflow(page);
    await page.screenshot({path:`artifacts/progress-redesign/bodyweight-${width}.png`,fullPage:true});
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gym-hawk-v4')!));
    expect(saved.sessions).toEqual(store.sessions); expect(saved.body).toEqual(store.body);
    await page.evaluate(() => { document.documentElement.style.fontSize='20px'; });
    await noOverflow(page);
  });
}

test('empty and single-date states stay honest and let the lifter begin', async ({page}) => {
  const store = freshStore(); await seed(page, store);
  await expect(page.locator('.featured-lift')).toHaveCount(0);
  await expect(page.getByRole('heading', {name:'Your first set is the starting point'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Log bodyweight',exact:true})).toBeVisible();
  const single = fixture(); single.sessions = [single.sessions[0]];
  await replaceLocal(page, single); await page.reload();
  await expect(page.locator('.featured-lift').first()).toContainText('First recorded date');
  await expect(page.locator('.featured-lift [data-direction=up]')).toHaveCount(0);
});
