import { test, expect, type Page } from '@playwright/test';
import { freshStore, selectedWorkout, newSession, validateStore, doneSets, volume, type Store } from '../../src/model';
import fs from 'node:fs/promises';

function fixture(day=1,week=1) {
  const store=freshStore();store.programme.week=week;store.programme.attempts[0].week=week;
  const session=newSession(selectedWorkout(store,day)!,store);session.endedAt=session.startedAt+60000;
  session.exercises.forEach(e=>e.sets.forEach(s=>Object.assign(s,{weight:e.mode==='bodyweight'?0:12,rir:3,done:true})));
  store.sessions=[session];return store;
}
async function seed(page:Page,store:Store) {
  await page.addInitScript(raw=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('gym-hawk-v4',raw);sessionStorage.setItem('seeded','yes');}},JSON.stringify(store));
}
async function open(page:Page) {
  await page.goto('/#progress/history');await page.locator('.history-row').first().click();
}
async function edit(page:Page) { await page.getByRole('button',{name:'Edit workout',exact:true}).click(); }
async function close(page:Page) { await page.getByRole('button',{name:'Back to previous screen',exact:true}).click(); }
async function backup(page:Page) {
  await page.goto('/#settings');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();
  return JSON.parse(await fs.readFile((await(await download).path())!,'utf8')) as Store;
}
const exercise=(page:Page,index=0)=>page.locator('.detail-exercise').nth(index);
const add=(page:Page,index=0)=>exercise(page,index).getByRole('button',{name:/^Add set to /});

test('saved additions are drafts until saved, survive offline reload and backup restore, and retain future counts',async({page,context})=>{
  const store=fixture(),original=store.sessions[0],name=original.exercises[0].name;
  await seed(page,store);await open(page);await edit(page);await add(page).click();
  const weight=page.getByLabel(`${name} set 3 weight`,{exact:true}),logged=page.getByLabel(`${name} set 3 logged`,{exact:true});
  await expect(weight).toBeFocused();await expect(weight).toHaveValue('12');await expect(logged).not.toBeChecked();
  await expect(exercise(page).locator('.detail-set').last()).toContainText('Extra');
  await expect(page.locator('.unit-badge')).toContainText('Partial');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await edit(page);
  await expect(exercise(page).locator('.detail-set')).toHaveCount(2);
  await add(page).click();await close(page);await open(page);await edit(page);
  await expect(exercise(page).locator('.detail-set')).toHaveCount(2);
  await add(page).click();await weight.fill('15');await logged.check();
  await expect(exercise(page).getByRole('button',{name:/^Remove /})).toHaveCount(0);
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.locator('.unit-badge')).toContainText('Complete');
  await expect(page.locator('.summary-pills')).toContainText(`${doneSets(original)+1} sets`);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
  await close(page);await context.setOffline(true);await page.reload();await open(page);
  await expect(exercise(page).locator('.detail-set').last()).toContainText('15 kg');await close(page);
  const data=await backup(page),saved=data.sessions[0];
  expect(saved.exercises[0].sets[2]).toEqual({weight:15,reps:original.exercises[0].sets[1].reps,rir:null,done:true});
  expect({...saved,exercises:original.exercises}).toEqual(original);expect(volume(saved)).toBe(volume(original)+15*saved.exercises[0].sets[2].reps);validateStore(data);
  await page.getByLabel('Import backup file').setInputFiles({name:'saved-extras.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.getByRole('button',{name:'Replace data and restore'}).click();await page.reload();expect(await backup(page)).toEqual(data);
  await page.goto('/#programme');await page.getByRole('tab',{name:'Mon Upper A',exact:true}).click();await page.getByRole('button',{name:'Train this session today',exact:true}).click();
  await expect(page.getByRole('group',{name:'Current working set'})).toContainText('Set 1 of 2');await context.setOffline(false);
});

test('saved unlogged extras persist as partial and enforce the ten-set and removal rules',async({page})=>{
  const store=fixture();await seed(page,store);await open(page);await edit(page);
  expect(await exercise(page).getByRole('button',{name:/^Remove /}).count()).toBe(0);
  for(let i=2;i<10;i++)await add(page).click();
  await expect(add(page)).toBeDisabled();await expect(exercise(page).getByText('10-set limit reached for this exercise.',{exact:true})).toBeVisible();
  await expect(exercise(page).getByRole('button',{name:/^Remove /})).toHaveCount(1);
  await exercise(page).getByRole('button',{name:/^Remove extra set 10 from /}).click();await expect(add(page)).toBeFocused();await expect(add(page)).toBeEnabled();
  await add(page).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.locator('.unit-badge')).toContainText('Partial');await close(page);await page.reload();await open(page);await edit(page);
  await expect(add(page)).toBeDisabled();await expect(exercise(page).locator('.detail-set')).toHaveCount(10);
  const last=exercise(page).locator('.detail-set').last();await last.getByRole('checkbox').check();await expect(last.getByRole('button')).toHaveCount(0);
  await last.getByRole('checkbox').uncheck();await last.getByRole('button',{name:/^Remove /}).click();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await close(page);
  const data=await backup(page);expect(data.sessions[0].exercises[0].sets).toHaveLength(9);expect(doneSets(data.sessions[0])).toBe(doneSets(store.sessions[0]));validateStore(data);
});

test('partially saved workouts allow sets on exercises with no logged sets and retain validation',async({page})=>{
  const store=fixture(),name=store.sessions[0].exercises[1].name;
  store.sessions[0].exercises[1].sets.forEach(s=>{s.done=false;s.weight=null;});
  await seed(page,store);await open(page);await edit(page);await add(page,1).click();
  const index=store.sessions[0].exercises[1].sets.length+1;
  const weight=page.getByLabel(`${name} set ${index} weight`,{exact:true});await expect(weight).toBeFocused();await expect(weight).toHaveValue('');
  await page.getByLabel(`${name} set ${index} logged`,{exact:true}).check();await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Logged sets need a valid weight');
  await weight.fill('18');await page.getByRole('button',{name:'Save changes',exact:true}).click();await close(page);
  const data=await backup(page);expect(data.sessions[0].exercises[1].sets.at(-1)).toMatchObject({weight:18,done:true});validateStore(data);
});

test('saved extras preserve pounds, assistance, bodyweight, timed and per-side values',async({page})=>{
  const store=fixture(4,9);store.settings.unit='lb';await seed(page,store);await open(page);await edit(page);
  for(const index of [0,3,6]) {
    const log=store.sessions[0].exercises[index],spec=store.sessions[0].workout.exercises[index],set=log.sets.length+1;
    await add(page,index).click();
    const weight=page.getByLabel(`${log.name} set ${set} weight`,{exact:true}),reps=page.getByLabel(`${log.name} set ${set} ${spec.timed?'seconds':'reps'}`,{exact:true});
    await expect(log.mode==='bodyweight'?reps:weight).toBeFocused();await expect(reps).toHaveValue(String(log.sets.at(-1)!.reps));
    if(log.mode==='bodyweight')await expect(weight).toBeDisabled();else await expect(weight).toHaveValue('26.46');
    await page.getByLabel(`${log.name} set ${set} logged`,{exact:true}).check();
  }
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(exercise(page,6).locator('.detail-set').last()).toContainText('sec / side');await close(page);
  const data=await backup(page);for(const i of [0,3,6])expect(data.sessions[0].exercises[i].sets.at(-1)).toEqual({...store.sessions[0].exercises[i].sets.at(-1),rir:null});validateStore(data);
});

test('saved extra controls and inputs fit narrow phones and return keyboard focus after removal',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await seed(page,fixture());
  for(const [width,height] of [[320,568],[390,844]]) {
    await page.setViewportSize({width,height});await open(page);await edit(page);await add(page).click();
    const row=exercise(page).locator('.detail-set').last(),input=row.locator('input').first();await expect(input).toBeFocused();
    const dialog=await page.getByRole('dialog').boundingBox();
    for(const control of await row.locator('input[type=number],button,.completion-checkbox').all()) {
      const box=await control.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(dialog!.x);expect(box!.x+box!.width).toBeLessThanOrEqual(dialog!.x+dialog!.width);
    }
    expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`saved-extra-${width}.png`)});
    await row.getByRole('button',{name:/^Remove /}).click();await expect(add(page)).toBeFocused();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();await close(page);
  }
});
