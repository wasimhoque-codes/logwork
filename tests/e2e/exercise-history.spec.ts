import { test, expect, type Page } from '@playwright/test';
import { freshStore, selectedWorkout, newSession, addSessionSet, localDate, number, fromKg, type Store } from '../../src/model';

function fixture(day=1,count=6) {
  const store=freshStore();store.programme.week=9;store.programme.attempts[0].week=9;
  store.active=newSession(selectedWorkout(store,day)!,store);
  store.sessions=Array.from({length:count},(_,i)=>{
    const old=structuredClone(store.active!);old.id=crypto.randomUUID();old.startedAt-=(i+1)*86400000;old.endedAt=old.startedAt+60000;old.date=localDate(new Date(old.startedAt));
    old.exercises.forEach(e=>e.sets.forEach(s=>Object.assign(s,{weight:e.mode==='bodyweight'?0:21+i,rir:0,done:true})));
    if(i===0){const extra=addSessionSet(old,0);extra.exercises[0].sets.at(-1)!.done=true;extra.exercises[0].sets[1].done=false;return extra;}
    return old;
  });
  return store;
}
async function seed(page:Page,store:Store) {
  await page.addInitScript(raw=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('gym-hawk-v4',raw);sessionStorage.setItem('seeded','yes');}},JSON.stringify(store));
}
const history=(page:Page)=>page.getByRole('button',{name:/^History for /});
const sheet=(page:Page)=>page.getByRole('dialog',{name:'Exercise history',exact:true});
async function close(page:Page) { await page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click(); }
async function jump(page:Page,name:string) {
  await page.getByRole('button',{name:/Exercise \d of/}).click();await page.getByRole('dialog').getByRole('button',{name:new RegExp(name)}).click();
}
const raw=(page:Page)=>page.evaluate(()=>localStorage.getItem('gym-hawk-v4'));

test('compact history shows five dated sessions, preserves input and edit drafts, and leaves rest running',async({page})=>{
  const store=fixture();store.sessions.forEach(s=>s.exercises[1].sets.forEach(set=>set.done=false));
  await page.clock.install({time:new Date(store.active!.startedAt)});await seed(page,store);await page.goto('/#workout');
  await expect(page.locator('.previous-hint')).toHaveCount(0);await expect(page.locator('.exercise-history-list')).toHaveCount(0);
  await page.getByLabel('Set 1 weight in kg').fill('18');await page.getByLabel('Set 1 reps',{exact:true}).fill('10');
  const before=await raw(page);await history(page).click();
  await expect(sheet(page)).toContainText(store.active!.exercises[0].name);await expect(sheet(page).locator('.exercise-history-session')).toHaveCount(5);
  const latest=sheet(page).locator('.exercise-history-session').first();
  await expect(latest).toContainText('Week 9');await expect(latest.locator('li')).toHaveCount(3);
  await expect(latest.locator('li').nth(0)).toContainText('Set 1');await expect(latest.locator('li').nth(1)).toContainText('Set 3');await expect(latest.locator('li').nth(2)).toContainText('Set 4');
  await expect(latest.locator('li').last()).toContainText('Extra');await expect(latest).toContainText('0 RIR');await expect(latest).toContainText('21 kg');
  expect(await sheet(page).locator('time').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('datetime')))).toEqual(store.sessions.slice(0,5).map(s=>s.date));
  await expect(sheet(page).locator('input,textarea,select')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(history(page)).toBeFocused();expect(await raw(page)).toBe(before);
  await expect(page.getByLabel('Set 1 weight in kg')).toHaveValue('18');await expect(page.getByLabel('Set 1 reps',{exact:true})).toHaveValue('10');
  await page.getByRole('button',{name:'Log set 1',exact:true}).click();
  await page.locator('.logged-sets summary').click();await page.getByRole('button',{name:'Edit set 1',exact:true}).click();await page.getByLabel('Set 1 weight in kg').fill('22');
  await history(page).click();await page.clock.fastForward(10000);await close(page);
  await expect(history(page)).toBeFocused();await expect(page.getByLabel('Set 1 weight in kg')).toHaveValue('22');await expect(page.getByRole('button',{name:'Save set 1',exact:true})).toBeVisible();
  await expect(page.getByRole('group',{name:'Rest timer'})).toContainText('1:50');
  await page.getByRole('button',{name:'Cancel edit',exact:true}).click();await page.getByRole('button',{name:'More exercise options'}).click();
  await page.getByRole('button',{name:'Copy last session',exact:true}).click();await close(page);
  await expect(page.getByLabel('Set 2 weight in kg')).toHaveValue('21');
  const active=JSON.parse((await raw(page))!).active;expect(active.exercises[0].sets[0].weight).toBe(18);
  await jump(page,'Chest-Supported Machine Row');await history(page).click();await expect(sheet(page)).toContainText('No previous logged sets for this exercise and setup yet.');
  await close(page);await jump(page,'Incline Dumbbell Press, Neutral Grip');await history(page).click();await expect(sheet(page).locator('.exercise-history-session')).toHaveCount(5);
});

test('history reflects saved-workout edits and added sets and survives offline reload',async({page,context})=>{
  const store=fixture(1,1),name=store.sessions[0].exercises[0].name;
  await seed(page,store);await page.goto('/#progress/history');await page.locator('.history-row').first().click();await page.getByRole('button',{name:'Edit workout',exact:true}).click();
  await page.getByLabel(`${name} set 1 weight`,{exact:true}).fill('37');
  await page.getByRole('button',{name:`Add set to ${name}`,exact:true}).click();await page.getByLabel(`${name} set 5 weight`,{exact:true}).fill('39');await page.getByLabel(`${name} set 5 logged`,{exact:true}).check();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('button',{name:'Back to previous screen',exact:true}).click();
  await page.goto('/#workout');await history(page).click();await expect(sheet(page)).toContainText('37 kg');await expect(sheet(page).locator('li').last()).toContainText('Set 5');await expect(sheet(page).locator('li').last()).toContainText('39 kg');
  await close(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
  await context.setOffline(true);await page.reload();await history(page).click();await expect(sheet(page)).toContainText('37 kg');await expect(sheet(page)).toContainText('39 kg');await context.setOffline(false);
});

test('history respects pounds, assistance, bodyweight and timed per-side snapshots',async({page})=>{
  const store=fixture(4,1);store.settings.unit='lb';await seed(page,store);await page.goto('/#workout');
  await history(page).click();await expect(sheet(page)).toContainText(`${number(fromKg(21,'lb'))} lb assistance`);await close(page);
  for(const index of [3,6]) {
    await jump(page,store.active!.exercises[index].name);await history(page).click();
    if(index===6){await expect(sheet(page)).toContainText('Bodyweight');await expect(sheet(page)).toContainText('sec / side');await expect(sheet(page)).not.toContainText('lb');}
    else {await expect(sheet(page)).toContainText('lb assistance');await expect(sheet(page)).toContainText('reps');}
    await close(page);
  }
});

test('History remains available without saved sessions and returns focus after dismissal',async({page})=>{
  await seed(page,fixture(1,0));await page.goto('/#workout');await history(page).click();await expect(sheet(page)).toContainText('No previous logged sets');
  await page.keyboard.press('Shift+Tab');await expect(sheet(page).getByRole('button',{name:'Close dialog'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(history(page)).toBeFocused();await expect(page.getByRole('button',{name:'Log set 1',exact:true})).toBeVisible();
});

test('compact link and scrollable history fit 320px and 390px phones without obstructing logging',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await seed(page,fixture());
  for(const [width,height] of [[320,568],[390,844]]) {
    await page.setViewportSize({width,height});await page.goto('/#workout');await history(page).scrollIntoViewIfNeeded();
    const link=await history(page).boundingBox(),dock=await page.locator('.workout-dock').boundingBox();expect(link!.height).toBeGreaterThanOrEqual(44);expect(link!.y+link!.height).toBeLessThanOrEqual(dock!.y);
    await page.screenshot({path:testInfo.outputPath(`history-link-${width}.png`)});await history(page).click();
    expect(await sheet(page).evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await expect(sheet(page).getByRole('button',{name:'Close dialog'})).toBeInViewport();
    await page.screenshot({path:testInfo.outputPath(`history-sheet-${width}.png`)});
    await sheet(page).locator('.exercise-history-session').last().scrollIntoViewIfNeeded();await expect(sheet(page).locator('.exercise-history-session').last()).toBeInViewport();
    await sheet(page).getByRole('button',{name:'Close dialog'}).click();await expect(history(page)).toBeFocused();await expect(page.getByRole('button',{name:'Log set 1',exact:true})).toBeVisible();
  }
});
