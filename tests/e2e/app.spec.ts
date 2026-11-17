import { test, expect, type Page } from './fixture';
import { freshStore, selectedWorkout, newSession, currentAttempt, localDate, validateStore, reviewWeek, type Store } from '../../src/model';
import { fixedWorkoutForDay } from '../../src/data';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
const go=async(page:Page,route:string)=>page.goto('/#'+route);
function atWeek(week:number){const s=freshStore();s.programme.week=week;s.programme.attempts[0].week=week;return s;}
async function seed(page:Page,store:unknown){await page.addInitScript(raw=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('gym-hawk-v4',raw);sessionStorage.setItem('seeded','yes');}},JSON.stringify(store));}
async function startMonday(page:Page){await go(page,'programme');await page.getByRole('tab',{name:'Mon Upper A',exact:true}).click();await page.getByRole('button',{name:'Train this session today',exact:true}).click();await expect(page.getByRole('heading',{name:'Incline Dumbbell Press, Neutral Grip',exact:true})).toBeVisible();}
async function close(page:Page){await page.getByRole('dialog').getByRole('button',{name:/^(Close dialog|Back to previous screen)$/}).click();}
async function jump(page:Page,name:string){await page.getByRole('button',{name:/Exercise \d of/}).click();await page.getByRole('dialog').getByRole('button',{name:new RegExp(name)}).click();}
async function backup(page:Page){await go(page,'settings');const event=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();return JSON.parse(await fs.readFile((await(await event).path())!,'utf8')) as Store;}
async function save(page:Page){await page.getByRole('button',{name:'Review and finish workout',exact:true}).click();await expect(page.getByRole('heading',{name:'Review workout',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save workout',exact:true}).click();await expect(page.getByRole('heading',{name:'Workout saved',exact:true})).toBeVisible();}
async function discard(page:Page){await page.getByRole('button',{name:'More exercise options',exact:true}).click();await page.getByRole('button',{name:'Discard workout',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Discard workout',exact:true}).click();}
function savedWorkout(store:Store,day=1){const s=newSession(selectedWorkout(store,day)!,store);s.endedAt=s.startedAt+60000;s.exercises.forEach(e=>e.sets.forEach(set=>Object.assign(set,{weight:e.mode==='bodyweight'?0:12,done:true})));return s;}

test('three-tab navigation, old links and returning from settings',async({page})=>{
  await go(page,'today');await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:/^(Today|Programme|Progress)$/})).toHaveCount(3);await expect(page.getByRole('tablist',{name:'Weekly programme'})).toHaveCount(0);
  for(const [alias,title,url] of [['plan','Programme','programme'],['insights','Progress','progress'],['history','Progress','progress/history']]){await go(page,alias);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page).toHaveURL(new RegExp('#'+url+'$'));}
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Go back',exact:true}).click();await expect(page.getByRole('tab',{name:/^History/})).toHaveAttribute('aria-selected','true');
});
test('today starts in one tap and prefilled sets log in one tap',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-26T10:00:00Z'));await go(page,'today');await page.getByRole('button',{name:'Start workout',exact:true}).click();await expect(page.getByRole('group',{name:'Current working set'})).toContainText('Set 1 of 2');
  await page.getByLabel('Set 1 weight in kg').fill('12');await page.getByLabel('Set 1 RIR',{exact:true}).selectOption('4');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await expect(page.getByLabel('Set 2 weight in kg')).toHaveValue('12');await page.getByRole('button',{name:'Log set 2',exact:true}).click();await expect(page.getByRole('heading',{name:'Exercise complete',exact:true})).toBeVisible();await expect(page.locator('.workout-dock').getByRole('button',{name:'Next exercise',exact:true})).toBeVisible();await page.getByRole('button',{name:'More exercise options'}).click();await page.getByLabel('Exercise notes',{exact:true}).fill('Bench setting two');await close(page);const data=await backup(page);expect(data.active!.exercises[0].sets[0].rir).toBe(4);expect(data.active!.exercises[0].note).toBe('Bench setting two');
});

test('Today shows the partial workout actually saved and keeps it on reload', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.clock.setFixedTime(new Date('2026-11-16T12:00:00Z'));
  await go(page, 'today');
  const card = page.getByRole('region', {name:'Today’s workout'});
  await expect(card.getByRole('heading', {name:'Upper A'})).toBeVisible();
  await go(page, 'programme');
  await page.getByRole('tab', {name:'Tue Lower A'}).click();
  await page.getByRole('button', {name:'Train this session today'}).click();
  await page.getByLabel('Set 1 weight in kg').fill('12');
  await page.getByRole('button', {name:'Log set 1', exact:true}).click();
  await save(page);
  await page.getByRole('button', {name:'Back to Today'}).click();
  await expect(card.locator('.today-check')).toHaveCount(0);
  await expect(card.getByRole('button',{name:'Scheduled today · Upper A'})).toBeVisible();

  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(card.getByRole('status')).toHaveText('Partial workout saved');
    await expect(card.getByRole('heading', {name:'Lower A'})).toBeVisible();
    await expect(card.getByText('1 exercise · 1 set logged')).toBeVisible();
    await expect(card.getByRole('button', {name:'Start workout'})).toHaveCount(0);
  }
  const view = card.getByRole('button', {name:'View workout', exact:true});
  await view.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Lower A');
  await close(page);
  await expect(view).toBeFocused();
});

const previews = [
  {date:'2026-11-16', tomorrow:'2026-11-17', tab:'Tue Lower A', summary:'Legs, glutes and core', workoutDay:2},
  {date:'2026-11-17', tomorrow:'2026-11-18', tab:'Wed Active recovery', summary:'Try hip switches or open books.'},
  {date:'2026-11-20', tomorrow:'2026-11-21', tab:'Sat Upper C', summary:'Calisthenics, shoulders and arms', workoutDay:6},
  {date:'2026-11-21', tomorrow:'2026-11-22', tab:'Sun Rest', summary:'Rest, or take an easy walk and do some gentle mobility.'},
];
for (const preview of previews) {
  test(`Today previews and opens ${preview.tab}`, async ({page}) => {
    await page.clock.setFixedTime(new Date(preview.date + 'T12:00:00Z'));
    const store = freshStore();
    store.programme.options.saturdayTwoSets = true;
    const session = savedWorkout(store);
    session.date = preview.date;
    store.sessions = [session];
    await seed(page, store);
    await go(page, 'today');
    const upcoming = page.getByRole('button', {name:/^Up next/});
    await expect(upcoming).toContainText(preview.summary);
    await expect(upcoming.locator('time')).toHaveAttribute('datetime', preview.tomorrow);
    if (preview.workoutDay) {
      const workout = fixedWorkoutForDay(preview.workoutDay, store.programme.options)!;
      const sets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
      await expect(upcoming).toContainText(`${workout.exercises.length} exercises · ${sets} working sets`);
      if (workout.optional) await expect(upcoming).toContainText('Optional');
    }
    await upcoming.click();
    await expect(page.getByRole('tab', {name:preview.tab})).toHaveAttribute('aria-selected', 'true');
  });
}

test('Today prioritises the active workout and rolls over at local midnight', async ({page}) => {
  await page.clock.install({time:new Date(2026, 10, 16, 23, 59, 50)});
  await page.emulateMedia({reducedMotion:'reduce'});
  const store = freshStore();
  const older = savedWorkout(store, 1);
  const latest = savedWorkout(store, 2);
  older.date = latest.date = '2026-11-16';
  latest.endedAt = older.endedAt! + 30000;
  store.sessions = [latest, older];
  store.active = newSession(fixedWorkoutForDay(4, store.programme.options)!, store);
  store.active.date = older.date;
  await seed(page, store);
  await go(page, 'today');
  const card = page.getByRole('region', {name:'Today’s workout'});
  await expect(card.getByRole('status')).toHaveText('In progress');
  await expect(card.getByRole('heading', {name:'Upper B'})).toBeVisible();
  await expect(card.getByRole('button', {name:'Resume Upper B'})).toBeVisible();
  await expect(card.locator('.today-check')).toHaveCount(0);
  await page.clock.fastForward(11000);
  await expect(page.locator('.today-date')).toHaveAttribute('datetime', '2026-11-17');
  await expect(card.getByRole('status')).toHaveText('In progress');
  await expect(card.getByRole('button', {name:/^Up next/})).toHaveCount(0);
  await card.getByRole('button', {name:'Resume Upper B'}).click();
  await expect(page.getByRole('heading', {name:'Upper B', exact:true})).toBeVisible();
});
test('inline errors focus the field and never log invalid sets',async({page})=>{
  await startMonday(page);await page.getByRole('button',{name:'Log set 1',exact:true}).click();await expect(page.locator('.app-shell').getByRole('alert')).toContainText('Enter a valid weight');await expect(page.getByLabel('Set 1 weight in kg')).toBeFocused();
  await page.getByLabel('Set 1 weight in kg').fill('12');await page.getByLabel('Set 1 reps',{exact:true}).fill('');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await expect(page.locator('.app-shell').getByRole('alert')).toContainText('repetitions');await expect(page.getByLabel('Set 1 reps',{exact:true})).toBeFocused();const data=await backup(page);expect(data.active!.exercises[0].sets[0].done).toBe(false);
});
test('selected exercise and running or paused rest survive reload and navigation',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-26T10:00:00Z'));await startMonday(page);await page.getByLabel('Set 1 weight in kg').fill('12');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await expect(page.getByRole('group',{name:'Rest timer'})).toContainText('2:00');await jump(page,'Chest-Supported Machine Row');await page.reload();await expect(page.getByRole('heading',{name:'Chest-Supported Machine Row',exact:true})).toBeVisible();await expect(page.getByRole('group',{name:'Rest timer'})).toContainText('2:00');
  await page.getByRole('button',{name:'Pause rest timer'}).click();await page.getByRole('button',{name:'Add 30 seconds rest'}).click();await page.reload();await expect(page.getByRole('group',{name:'Rest timer'})).toContainText('Paused');await expect(page.getByRole('group',{name:'Rest timer'})).toContainText('2:30');await page.getByRole('button',{name:'Resume rest timer'}).click();await page.getByRole('button',{name:'Skip rest timer'}).click();await expect(page.getByRole('group',{name:'Rest timer'})).toHaveCount(0);
  await page.getByRole('button',{name:'Leave workout'}).click();await expect(page.getByRole('heading',{name:'Programme',exact:true})).toBeVisible();await page.getByRole('button',{name:'Resume Upper A',exact:true}).click();await expect(page.getByRole('heading',{name:'Chest-Supported Machine Row',exact:true})).toBeVisible();
});
test('expired rest never logs a set or advances an exercise',async({page})=>{
  const s=atWeek(1);s.active=newSession(selectedWorkout(s,1)!,s);s.active.resume={exerciseIndex:2,restEnd:Date.now()-1000,restPaused:null};await seed(page,s);await go(page,'workout');await expect(page.getByRole('heading',{name:'Neutral-Grip Lat Pulldown',exact:true})).toBeVisible();await expect(page.getByRole('group',{name:'Rest timer'})).toHaveCount(0);const data=await backup(page);expect(data.active!.resume!.exerciseIndex).toBe(2);expect(data.active!.exercises.flatMap(e=>e.sets).some(set=>set.done)).toBe(false);
});
test('exercise jumping, editing and undo preserve unfinished sets',async({page})=>{
  await startMonday(page);await page.getByLabel('Set 1 weight in kg').fill('12');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await page.getByText('All sets',{exact:false}).first().click();await page.getByRole('button',{name:'Edit set 1',exact:true}).click();await page.getByLabel('Set 1 weight in kg').fill('18');await page.getByRole('button',{name:'Cancel edit',exact:true}).click();await expect(page.locator('.logged-set').first()).toContainText('12 kg');await page.getByRole('button',{name:'Edit set 1',exact:true}).click();await page.getByLabel('Set 1 weight in kg').fill('14');await page.getByRole('button',{name:'Save set 1',exact:true}).click();await page.getByRole('button',{name:'Undo set 1',exact:true}).click();await expect(page.getByLabel('Set 1 weight in kg')).toHaveValue('14');await jump(page,'Pallof Press');await expect(page.getByRole('button',{name:'Review & finish',exact:true})).toBeVisible();const data=await backup(page);expect(data.active!.exercises[0].sets.every(set=>!set.done)).toBe(true);
});
test('adding and removing extras preserves the current set and edit drafts',async({page})=>{
  const s=atWeek(1);s.active=newSession(selectedWorkout(s,1)!,s);
  Object.assign(s.active.exercises[0].sets[1],{weight:14,reps:10,rir:3});
  await seed(page,s);await go(page,'workout');
  await page.getByLabel('Set 1 weight in kg').fill('12');
  await page.getByRole('button',{name:'Add set',exact:true}).click();
  await expect(page.getByRole('group',{name:'Current working set'})).toContainText('Set 1 of 3');
  await expect(page.getByLabel('Set 1 weight in kg')).toHaveValue('12');
  await page.locator('.logged-sets summary').click();
  await expect(page.locator('.logged-set').nth(2)).toContainText('Set 3 · Extra');
  await page.getByRole('button',{name:'Edit set 3',exact:true}).click();
  await expect(page.getByLabel('Set 3 weight in kg')).toHaveValue('14');
  await expect(page.getByLabel('Set 3 reps',{exact:true})).toHaveValue('10');
  await page.getByLabel('Set 3 weight in kg').fill('19');
  await page.getByRole('button',{name:'Add set',exact:true}).click();
  await expect(page.getByLabel('Set 3 weight in kg')).toHaveValue('19');
  await expect(page.getByRole('button',{name:'Remove extra set 3',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Remove extra set 4',exact:true}).click();
  await expect(page.getByLabel('Set 3 weight in kg')).toHaveValue('19');
  await page.getByRole('button',{name:'Remove extra set 3',exact:true}).click();
  await expect(page.getByRole('group',{name:'Current working set'})).toContainText('Set 1 of 2');
  await expect(page.getByRole('group',{name:'Current working set'})).toBeFocused();
  await expect(page.getByRole('button',{name:/Remove extra set/})).toHaveCount(0);
  await page.getByRole('button',{name:'Add set',exact:true}).click();
  const data=await backup(page);expect(data.active!.exercises[0].sets[2]).toEqual({weight:14,reps:10,rir:null,done:false});
  expect(data.active!.workout).toEqual(s.active.workout);validateStore(data);
});

test('extras survive offline reload, save, history editing and backup restore without changing future counts',async({page,context})=>{
  const s=atWeek(1);s.active=savedWorkout(s);delete s.active.endedAt;
  const originalCount=s.active.exercises.reduce((n,e)=>n+e.sets.length,0);
  await seed(page,s);await go(page,'workout');
  await expect(page.getByRole('heading',{name:'Exercise complete',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add set',exact:true}).click();
  await expect(page.getByRole('group',{name:'Current working set'})).toBeFocused();
  await expect(page.getByRole('group',{name:'Current working set'})).toContainText('Set 3 of 3');
  await expect(page.getByLabel('Set 3 weight in kg')).toHaveValue('12');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
  await context.setOffline(true);await page.reload();
  await expect(page.getByLabel('Set 3 weight in kg')).toHaveValue('12');
  await page.getByRole('button',{name:'Log set 3',exact:true}).click();
  await page.locator('.logged-sets summary').click();
  await expect(page.getByRole('button',{name:'Remove extra set 3',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Undo set 3',exact:true}).click();
  await expect(page.getByRole('button',{name:'Remove extra set 3',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Log set 3',exact:true}).click();
  await save(page);await page.getByRole('button',{name:'View workout',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText((originalCount+1)+' sets');
  await page.getByRole('button',{name:'Edit workout',exact:true}).click();
  await page.getByLabel('Incline Dumbbell Press, Neutral Grip set 3 weight',{exact:true}).fill('15');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await close(page);
  const data=await backup(page);expect(data.sessions[0].exercises[0].sets[2]).toMatchObject({weight:15,done:true});
  expect(data.sessions[0].workout).toEqual(s.active.workout);validateStore(data);
  await page.getByLabel('Import backup file').setInputFiles({name:'extras.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.getByRole('button',{name:'Replace data and restore'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();
  expect(await backup(page)).toEqual(data);
  await startMonday(page);await expect(page.getByRole('group',{name:'Current working set'})).toContainText('Set 1 of 2');
  await context.setOffline(false);
});

test('the ten-set limit survives reload and removal re-enables adding',async({page})=>{
  await startMonday(page);
  for(let i=2;i<10;i++)await page.getByRole('button',{name:'Add set',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add set',exact:true})).toBeDisabled();
  await expect(page.getByText('10-set limit reached for this exercise.',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Add set',exact:true})).toBeDisabled();
  await page.locator('.logged-sets summary').click();
  await page.getByRole('button',{name:'Remove extra set 10',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add set',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Add set',exact:true}).click();
  const data=await backup(page);expect(data.active!.exercises[0].sets).toHaveLength(10);validateStore(data);
});

test('extra sets preserve pounds, assistance, bodyweight, timed and per-side logging',async({page})=>{
  const s=atWeek(9);s.settings.unit='lb';s.active=newSession(selectedWorkout(s,4)!,s);
  await seed(page,s);await go(page,'workout');
  await page.getByLabel('Set 1 assistance in lb').fill('44');await page.getByRole('button',{name:'Log set 1',exact:true}).click();
  await page.getByRole('button',{name:'Add set',exact:true}).click();
  await page.locator('.logged-sets summary').click();await page.getByRole('button',{name:'Edit set 4',exact:true}).click();
  await expect(page.getByLabel('Set 4 assistance in lb')).toHaveValue('44');await page.getByRole('button',{name:'Cancel edit',exact:true}).click();
  await jump(page,'Side Plank');await expect(page.getByText('Complete both sides, then log one set.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add set',exact:true}).click();
  await page.getByRole('button',{name:'Log set 1',exact:true}).click();await page.getByRole('button',{name:'Log set 2',exact:true}).click();
  await expect(page.getByLabel('Set 3 seconds',{exact:true})).toHaveValue('20');
  await expect(page.getByLabel('Set 3 weight in lb')).toHaveCount(0);
  await page.getByRole('button',{name:'Log set 3',exact:true}).click();
  const data=await backup(page);expect(data.active!.exercises[6].sets[2]).toEqual({weight:0,reps:20,rir:null,done:true});
  expect(data.active!.exercises[0].sets[3].weight).toBeCloseTo(44/2.2046226218);validateStore(data);
});

test('add-set controls and focus remain usable above the dock on narrow phones',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const [width,height] of [[320,568],[390,844]]){
    await page.setViewportSize({width,height});await startMonday(page);
    const add=page.getByRole('button',{name:'Add set',exact:true});await add.scrollIntoViewIfNeeded();
    const button=await add.boundingBox(),dock=await page.locator('.workout-dock').boundingBox();
    expect(button!.y).toBeGreaterThanOrEqual(0);expect(button!.y+button!.height).toBeLessThanOrEqual(dock!.y);
    await add.click();await expect(page.getByLabel('Set 1 weight in kg')).toBeVisible();
    await page.getByLabel('Set 1 weight in kg').fill('12');
    for(let i=1;i<=3;i++)await page.getByRole('button',{name:'Log set '+i,exact:true}).click();
    await expect(page.getByRole('heading',{name:'Exercise complete',exact:true})).toBeVisible();
    await add.click();await expect(page.getByRole('group',{name:'Current working set'})).toBeFocused();
    const input=page.getByLabel('Set 4 weight in kg');await input.focus();await input.scrollIntoViewIfNeeded();
    const field=await input.boundingBox(),restDock=await page.locator('.workout-dock').boundingBox();
    expect(field!.y+field!.height).toBeLessThanOrEqual(restDock!.y);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:testInfo.outputPath('extra-set-'+width+'.png')});
    await page.locator('.logged-sets summary').click();await page.getByRole('button',{name:'Remove extra set 4',exact:true}).click();
    await discard(page);
  }
});

test('finish review keeps cool-down inline and saves once to confirmation',async({page})=>{
  await startMonday(page);await page.getByLabel('Set 1 weight in kg').fill('12');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await page.getByRole('button',{name:'Review and finish workout'}).click();await expect(page.getByText(/This will be saved as a partial workout/)).toBeVisible();await page.getByText('Cool-down checklist',{exact:false}).click();await page.getByRole('checkbox',{name:/Slow relaxed breathing/}).check();await page.reload();await expect(page.getByRole('heading',{name:'Review workout',exact:true})).toBeVisible();await page.getByText('Cool-down checklist',{exact:false}).click();await expect(page.getByRole('checkbox',{name:/Slow relaxed breathing/})).toBeChecked();await page.getByRole('button',{name:'Save workout',exact:true}).click();await expect(page.getByRole('heading',{name:'Workout saved',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'Back to Today',exact:true}).click();await expect(page.locator('.daily-progress')).toContainText('1 workout logged');const data=await backup(page);expect(data.sessions).toHaveLength(1);expect(data.sessions[0].cooldown![2]).toBe(true);expect(data.active).toBeNull();
});
test('the final logged set offers review instead of a disabled next action',async({page})=>{
  const s=atWeek(1),log=savedWorkout(s);delete log.endedAt;log.exercises.at(-1)!.sets.at(-1)!.done=false;log.resume={exerciseIndex:6,restEnd:null,restPaused:null};s.active=log;await seed(page,s);await go(page,'workout');await page.getByRole('button',{name:'Log set 2',exact:true}).click();await expect(page.getByRole('group',{name:'Rest timer'})).toHaveCount(0);await page.getByRole('button',{name:'Review & finish',exact:true}).click();await expect(page.getByRole('heading',{name:'Ready to save',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save workout',exact:true}).click();await expect(page.locator('.saved-summary').getByText('Week 1 · Complete',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to Today',exact:true}).click();await expect(page.locator('.daily-progress')).toContainText('1 workout logged');
});
test('another day’s programme never silently resumes the active session',async({page})=>{
  await startMonday(page);await page.getByRole('button',{name:'Leave workout'}).click();await page.getByRole('tab',{name:'Tue Lower A',exact:true}).click();await expect(page.getByRole('button',{name:'Train this session today',exact:true})).toBeDisabled();await expect(page.locator('.active-banner')).toContainText('Upper A is in progress');await page.getByRole('button',{name:'Resume Upper A',exact:true}).click();await expect(page.getByRole('heading',{name:'Incline Dumbbell Press, Neutral Grip',exact:true})).toBeVisible();await page.getByRole('button',{name:'Leave workout'}).click();await page.getByRole('button',{name:'Today',exact:true}).click();await expect(page.getByRole('tablist',{name:'Weekly programme'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Resume Upper A',exact:true})).toBeVisible();
});
test('saved alternatives keep active and historical prescriptions intact',async({page})=>{
  await seed(page,atWeek(5));await go(page,'programme');await page.getByRole('tab',{name:'Tue Lower A',exact:true}).click();await page.getByRole('button',{name:/Leg Press/}).click();await page.getByLabel('Exercise variation').selectOption('p16-belt-squat');await page.getByRole('button',{name:'Save exercise choice'}).click();await page.getByRole('button',{name:'Train this session today'}).click();await page.getByLabel('Set 1 weight in kg').fill('20');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await page.getByRole('button',{name:'Leave workout'}).click();await page.getByRole('button',{name:/Belt Squat/}).click();await page.getByLabel('Exercise variation').selectOption('p16-leg-press');await page.getByRole('button',{name:'Save exercise choice'}).click();await page.getByRole('button',{name:'Resume Lower A',exact:true}).click();await expect(page.getByRole('heading',{name:'Belt Squat',exact:true})).toBeVisible();await save(page);await page.getByRole('button',{name:'View workout',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Belt Squat');await page.getByRole('button',{name:'Edit workout',exact:true}).click();await page.getByLabel('Belt Squat set 1 weight',{exact:true}).fill('22');await page.getByRole('button',{name:'Save changes',exact:true}).click();await close(page);const data=await backup(page);expect(data.sessions[0].exercises[0].sets[0].weight).toBe(22);validateStore(data);
});
for (const week of [1, 2, 16]) test(`Week ${week} data can train the fixed schedule`, async ({ page }) => {
  const previous = atWeek(week);
  previous.sessions = [1, 2, 4, 5].map(day => savedWorkout(previous, day));
  const store = week === 16 ? reviewWeek(previous, 'advance') : previous;
  await seed(page, store);
  await go(page, 'today');
  await expect(page.locator('.weekly-card, .nav-programme, .review-ready')).toHaveCount(0);
  await go(page, 'programme');
  await expect(page.locator('.programme-heading')).toHaveText('Weekly schedule');
  await expect(page.getByRole('tablist', { name: 'Weekly programme' }).getByRole('tab')).toHaveCount(7);
  await expect(page.getByText('16-week roadmap')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Sat Upper C' }).click();
  await page.getByRole('button', { name: 'Train this session today' }).click();
  await expect(page.getByRole('heading', { name: 'Upper C', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Current working set' })).toContainText('Set 1 of 1');
  await discard(page);
  await startMonday(page);
  await expect(page.getByRole('group', { name: 'Current working set' })).toContainText('Set 1 of 2');
  const data = await backup(page);
  expect(data.programme).toEqual(store.programme);
  expect(data.sessions).toEqual(store.sessions);
  expect(data.active?.workout.prescriptionMode).toBe('fixed');
  expect(data.active?.workout.exercises[0].rir).toBe('3–4');
  expect(data.active?.feedback).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Programme week & review' })).toHaveCount(0);
});

test('Upper C options apply without advancing the week', async ({ page }) => {
  await go(page, 'programme');
  await page.getByRole('tab', { name: 'Sat Upper C' }).click();
  await page.getByRole('button', { name: 'Upper C settings' }).click();
  await page.getByRole('checkbox', { name: 'Use two sets per exercise' }).check();
  await page.getByRole('combobox', { name: 'Saturday core skill' }).selectOption('dead-bug');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Train this session today' }).click();
  await expect(page.getByRole('group', { name: 'Current working set' })).toContainText('Set 1 of 2');
  await jump(page, 'Dead Bug');
  await expect(page.getByRole('heading', { name: 'Dead Bug', exact: true })).toBeVisible();
});
test('optional knee raises require current-session confirmation and support dead bugs',async({page})=>{
  const s=atWeek(9);s.programme.options.saturdayCore='knee-raise';await seed(page,s);await go(page,'programme');await page.getByRole('tab',{name:'Sat Upper C'}).click();await page.getByRole('button',{name:'Train this session today'}).click();await expect(page.getByRole('button',{name:'Start with knee raises'})).toBeDisabled();await page.getByRole('button',{name:'Use dead bugs this session'}).click();await jump(page,'Dead Bug');await expect(page.getByText('Complete both sides, then log one set.',{exact:true})).toBeVisible();await expect(page.locator('.bodyweight-load')).toContainText('Bodyweight');
});
test('assistance and timed per-side sets retain their meaning',async({page})=>{
  await seed(page,atWeek(9));await go(page,'programme');await page.getByRole('tab',{name:'Thu Upper B'}).click();await page.getByRole('button',{name:'Train this session today'}).click();await page.getByLabel('Set 1 assistance in kg').fill('35');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await jump(page,'Side Plank');await page.getByLabel('Set 1 seconds').fill('25');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await save(page);const data=await backup(page);expect(data.sessions[0].exercises[0].sets[0].weight).toBe(35);expect(data.sessions[0].exercises[6].sets[0].reps).toBe(25);validateStore(data);
});
test('bodyweight remains available with replacement and no daily tracking',async({page})=>{
  await go(page,'today');await expect(page.getByRole('button',{name:/Daily check-in/})).toHaveCount(0);
  for(const value of ['61','62']){await page.getByRole('button',{name:/Log bodyweight/}).click();await page.getByLabel('Bodyweight (kg)',{exact:true}).fill(value);await page.getByRole('button',{name:'Save bodyweight'}).click();await expect(page.getByRole('dialog',{name:'Log bodyweight'})).toHaveCount(0);await page.reload();}
  const data=await backup(page);expect(data.daily).toEqual([]);expect(data.body).toHaveLength(1);expect(data.body[0].kg).toBe(62);
  await go(page,'progress/bodyweight');await expect(page.locator('.body-entries')).toContainText('62');await expect(page.getByRole('group',{name:/^Bodyweight trend/})).toBeVisible();await page.getByRole('button',{name:'Nutrition reference',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Maintenance +200–300 kcal/day');await close(page);await page.getByRole('button',{name:/Delete bodyweight for/}).click();await page.getByRole('button',{name:'Delete entry',exact:true}).click();await expect(page.locator('.body-entries')).toHaveCount(0);
  await go(page,'progress/recovery');await expect(page.getByRole('heading',{name:'Habit consistency'})).toHaveCount(0);await expect(page.getByRole('button',{name:/Daily check-in/})).toHaveCount(0);await expect(page).toHaveURL(/#progress$/);
});
test('loading and importing old version-4 check-ins removes only retired records',async({page})=>{
  const s=atWeek(9);s.settings={name:'Kept',unit:'lb',autoRest:false};s.sessions=[savedWorkout(s)];s.sessions[0].feedback!.before='stable';s.active=newSession(selectedWorkout(s,2)!,s);s.active.feedback!.before='none';s.body=[{id:'weight',date:localDate(),kg:61}];s.recovery=[{id:'recovery',date:localDate(),activity:'walking',cardio:20,mobility:10,note:'Keep',week:9,attemptId:currentAttempt(s).id}];
  const legacy={...s,daily:[{date:localDate(),symptoms:'worse',protein:true,sleep:false,surplus:null,movement:true}]};await seed(page,legacy);await go(page,'today');expect(await backup(page)).toEqual(s);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym-hawk-v4')!).daily)).toEqual([]);
  await page.getByLabel('Import backup file').setInputFiles({name:'older-v4.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await expect(page.getByRole('dialog')).not.toContainText('check-ins');await page.getByRole('button',{name:'Replace data and restore'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();expect(await backup(page)).toEqual(s);
  await page.evaluate(raw=>window.dispatchEvent(new StorageEvent('storage',{key:'gym-hawk-v4',newValue:raw})),JSON.stringify(legacy));expect(await backup(page)).toEqual(s);
});
for(const [date,day,week] of [['2026-11-04','Wed Active recovery',1],['2026-11-08','Sun Rest',1]]) {
  test(`rest-day suggestions are static on ${day} in week ${week}`,async({page})=>{
    await page.clock.setFixedTime(new Date(date+'T10:00:00Z'));await seed(page,atWeek(Number(week)));await go(page,'today');
    const activities=page.getByRole('list',{name:'Optional rest-day activities'});
    await expect(activities).toHaveText('MobilityRunningWalking');await expect(activities.locator('button,input')).toHaveCount(0);
    await expect(page.getByRole('button',{name:/Log recovery|Start workout/})).toHaveCount(0);
    await page.getByText('Mobility guide',{exact:true}).click();await expect(page.getByText(/Half-kneeling hip flexor/)).toBeVisible();
    await go(page,'programme');await page.getByRole('tab',{name:String(day),exact:true}).click();await expect(activities).toHaveText('MobilityRunningWalking');
    await expect(page.getByRole('button',{name:/Log recovery|Train this session today/})).toHaveCount(0);
    expect((await backup(page)).recovery).toEqual([]);
  });
}
test('retired feedback stays in backups and disappears from workout screens', async ({ page }) => {
  const store = atWeek(2);
  const existing = savedWorkout(store);
  existing.date = localDate(new Date(Date.now() - 86400000));
  existing.feedback = { ...existing.feedback!, before: 'stable', technique: true };
  store.sessions = [existing];
  store.recovery = [{ id: 'legacy-recovery', date: localDate(), activity: 'cycling', cardio: 25, mobility: 15, note: 'Archived activity', week: 2, attemptId: currentAttempt(store).id }];
  const active = newSession(selectedWorkout(store, 2)!, store);
  Object.assign(active.exercises[0].sets[0], { weight: 12, done: true });
  store.active = active;
  await seed(page, store);
  await go(page, 'today');
  await expect(page.getByText('How did you recover?')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume Lower A' }).click();
  await page.getByRole('button', { name: 'More exercise options' }).click();
  await expect(page.getByRole('dialog').getByText('Session symptoms & technique')).toHaveCount(0);
  await close(page);
  await page.getByRole('button', { name: 'Review and finish workout' }).click();
  await expect(page.getByText('How did it feel?')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout saved' })).toBeVisible();
  await go(page, 'progress/history');
  await expect(page.locator('.history-row')).toHaveCount(2);
  await expect(page.locator('main')).not.toContainText('Archived activity');
  await page.getByRole('button', { name: /Upper A ·? ?Week 2/ }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByText('Week 2 · Complete')).toBeVisible();
  await expect(detail.getByText(/Technique:|Review next-day recovery/)).toHaveCount(0);
  await detail.getByRole('button', { name: 'Edit workout' }).click();
  await detail.getByLabel('Session notes').fill('Kept my workout notes');
  await expect(detail.getByLabel('Controlled technique')).toHaveCount(0);
  await detail.getByRole('button', { name: 'Save changes' }).click();
  await close(page);
  await go(page, 'progress/recovery');
  await expect(page).toHaveURL(/#progress$/);
  await expect(page.getByRole('heading', { name: 'Volume & load' })).toBeVisible();
  await expect(page.getByText('Workout feedback', { exact: true })).toHaveCount(0);
  await go(page, 'progress/movement');
  await expect(page.getByText(/Conditional progression|Review following-day response/)).toHaveCount(0);
  const exported = await backup(page);
  expect(exported.recovery).toEqual(store.recovery);
  expect(exported.sessions.find(session => session.id === existing.id)).toEqual({ ...existing, note: 'Kept my workout notes' });
  expect(exported.sessions.find(session => session.id === active.id)?.feedback).toEqual(active.feedback);
  await page.getByLabel('Import backup file').setInputFiles({ name: 'legacy-recovery.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.getByRole('button', { name: 'Replace data and restore' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  expect(await backup(page)).toEqual(exported);
});
test('an active strength workout can resume on a rest day',async({page})=>{
  const s=atWeek(1);s.active=newSession(selectedWorkout(s,1)!,s);await seed(page,s);await page.clock.setFixedTime(new Date('2026-11-08T10:00:00Z'));await go(page,'today');
  await expect(page.getByRole('list',{name:'Optional rest-day activities'})).toHaveCount(0);await page.getByRole('button',{name:/Resume Upper A/}).click();await expect(page.getByRole('group',{name:'Current working set'})).toBeVisible();
});
test('Progress empty states lead to recorded exercises without inventing charts',async({page})=>{
  await go(page,'progress');await expect(page.getByRole('heading',{name:'Start with one session'})).toBeVisible();await page.getByRole('button',{name:'Explore exercises'}).click();await expect(page.getByRole('heading',{name:'Your exercise progress starts here'})).toBeVisible();await expect(page.locator('.exercise-tile')).toHaveCount(0);await go(page,'progress/recovery');await expect(page).toHaveURL(/#progress$/);await expect(page.locator('main')).not.toContainText('0 / 0');
});
test('Progress shows only recorded exercises and keeps volume units explicit',async({page})=>{
  const s=atWeek(5),session=savedWorkout(s);session.exercises.forEach((ex,i)=>{if(i)ex.sets.forEach(set=>set.done=false);});s.sessions=[session];await seed(page,s);await go(page,'progress/exercises');await expect(page.locator('.exercise-tile')).toHaveCount(1);await page.getByRole('button',{name:/View details for/}).click();await expect(page.getByRole('region',{name:'Selected training date'})).toBeVisible();await expect(page.getByLabel('Select exercise for strength chart')).toHaveCount(0);await go(page,'progress/volume');await expect(page.getByRole('heading',{name:'Volume · kg × reps'})).toBeVisible();
});
test('bodyweight units and new backup metadata round trip without altering v4 history',async({page})=>{
  const s=atWeek(9);s.active=newSession(selectedWorkout(s,4)!,s);s.active.resume={exerciseIndex:3,restEnd:null,restPaused:80};s.sessions=[savedWorkout(s)];s.body=[{id:'body',date:localDate(),kg:61}];await seed(page,s);const before=await backup(page);await page.getByRole('button',{name:'lb',exact:true}).click();await go(page,'progress/bodyweight');await page.getByRole('button',{name:'Log bodyweight',exact:true}).click();await page.getByLabel('Bodyweight (lb)',{exact:true}).fill('134.482');await page.getByRole('button',{name:'Save bodyweight'}).click();const exported=await backup(page);expect(exported.body[0].kg).toBeCloseTo(61,2);await page.getByLabel('Import backup file').setInputFiles({name:'v4.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await page.getByRole('button',{name:'Replace data and restore'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();expect(await backup(page)).toEqual(before);
  for(const version of [1,2,3]){await page.getByLabel('Import backup file').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...before,version}))});await expect(page.getByRole('status')).toContainText('only version-4 backups');}validateStore(before);
});
test('corrupt storage is preserved for raw export until a valid restore',async({page})=>{
  await seed(page,'not a store');await go(page,'settings');await expect(page.locator('.app-shell').getByRole('alert')).toContainText('Saved data could not be read');expect(await backup(page)).toBe('not a store');const store=freshStore();await page.getByLabel('Import backup file').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(store))});await page.getByRole('button',{name:'Replace data and restore'}).click();await expect(page.locator('.app-shell').getByRole('alert')).toHaveCount(0);expect(await backup(page)).toEqual(store);
});
test('a failed localStorage mirror retains old keys while IndexedDB saves bodyweight',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('gym-hawk-v3','old');const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='gym-hawk-v4')throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};});await go(page,'today');await expect(page.locator('.app-shell').getByRole('alert')).toHaveCount(0);await page.getByRole('button',{name:/Log bodyweight/}).click();await page.getByLabel('Bodyweight (kg)',{exact:true}).fill('61');await page.getByRole('button',{name:'Save bodyweight'}).click();await expect(page.locator('.app-shell').getByRole('alert')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('gym-hawk-v3'))).toBe('old');const data=await backup(page);expect(data.body[0].kg).toBe(61);expect(data.daily).toEqual([]);
});
test('older version-4 active workouts restore to the first unfinished exercise',async({page})=>{
  const s=atWeek(1);s.active=newSession(selectedWorkout(s,1)!,s);delete s.active.resume;s.active.exercises[0].sets.forEach(set=>Object.assign(set,{weight:12,done:true}));const raw=JSON.stringify(s);await seed(page,s);await go(page,'workout');await expect(page.getByRole('heading',{name:'Chest-Supported Machine Row',exact:true})).toBeVisible();expect(JSON.parse((await page.evaluate(()=>localStorage.getItem('gym-hawk-v4')))!)).toEqual(JSON.parse(raw));await page.getByRole('button',{name:'Warm-up',exact:true}).click();await page.getByRole('checkbox',{name:/Easy treadmill/}).check();await close(page);await page.reload();await page.getByRole('button',{name:'Warm-up',exact:true}).click();await expect(page.getByRole('checkbox',{name:/Easy treadmill/})).toBeChecked();
});
test('offline workout and bodyweight logging, reload and backup restore work',async({page,context})=>{
  await startMonday(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});await context.setOffline(true);await page.reload();await page.getByLabel('Set 1 weight in kg').fill('12');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await save(page);await page.getByRole('button',{name:'Back to Today',exact:true}).click();await page.getByRole('button',{name:/Log bodyweight/}).click();await page.getByLabel('Bodyweight (kg)',{exact:true}).fill('61');await page.getByRole('button',{name:'Save bodyweight'}).click();const data=await backup(page);expect(data.sessions[0].exercises[0].sets[0].weight).toBe(12);expect(data.body[0].kg).toBe(61);expect(data.daily).toEqual([]);data.settings.name='Offline';await page.getByLabel('Import backup file').setInputFiles({name:'offline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.getByRole('button',{name:'Replace data and restore'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.getByRole('textbox',{name:'What should we call you?'})).toHaveValue('Offline');
});
test('service-worker upgrades preserve v4 history, selected exercise and paused rest',async({page,context})=>{
  const worker=await fs.readFile(path.resolve('.open-next/assets/sw.js'),'utf8');let old=true;
  const server=createServer(async(req,res)=>{const pathname=new URL(req.url!,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');if(pathname==='/sw.js'){res.setHeader('Content-Type','application/javascript');res.end(old?worker.replace(/gym-hawk-next-[a-f0-9]{16}/,'gym-hawk-upgrade-fixture'):worker);return;}try{const upstream=await fetch(new URL(req.url!,process.env.PW_BASE_URL??'http://127.0.0.1:4174'));res.statusCode=upstream.status;res.setHeader('Content-Type',upstream.headers.get('content-type')??'application/octet-stream');res.end(Buffer.from(await upstream.arrayBuffer()));}catch{res.statusCode=502;res.end();}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as {port:number};
  try{const s=atWeek(5);s.active=newSession(selectedWorkout(s,1)!,s);s.active.resume={exerciseIndex:2,restEnd:null,restPaused:85};s.sessions=[savedWorkout(s,2)];await seed(page,s);await page.goto('http://127.0.0.1:'+address.port+'/#workout');await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});old=false;await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await new Promise<void>(async resolve=>{navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true});await reg!.update();});});await expect.poll(()=>page.evaluate(()=>caches.keys())).not.toContain('gym-hawk-upgrade-fixture');await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Neutral-Grip Lat Pulldown',exact:true})).toBeVisible();await expect(page.getByRole('group',{name:'Rest timer'})).toContainText('1:25');expect(JSON.parse((await page.evaluate(()=>localStorage.getItem('gym-hawk-v4')))!)).toEqual(s);
  }finally{await context.setOffline(false);await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
test('mobile visual review, primary actions, keyboard clearance and focus',async({page},testInfo)=>{
  test.setTimeout(90000);await page.clock.setFixedTime(new Date('2026-11-02T10:00:00Z'));await page.emulateMedia({reducedMotion:'reduce'});
  for(const [width,height] of [[320,568],[390,844],[768,1000],[1440,1000]]){
    await page.setViewportSize({width,height});const capture=async(name:string)=>{await expect(page.locator('.app-header h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),name+' '+width).toBe(false);if(testInfo.project.name==='desktop'){await fs.mkdir('artifacts/checkin-removal',{recursive:true});await page.screenshot({path:'artifacts/checkin-removal/'+name+'-'+width+'.png'});}};
    await go(page,'today');await capture('today');if(width===320){const cta=await page.locator('.hero-button').boundingBox(),nav=await page.getByRole('navigation',{name:'Main navigation'}).boundingBox();expect(cta!.y+cta!.height).toBeLessThanOrEqual(nav!.y);}
    await page.getByRole('button',{name:/Log bodyweight/}).click();await capture('bodyweight-entry');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:/Log bodyweight/})).toBeFocused();
    for(const route of ['programme','progress','progress/history','progress/bodyweight','progress/recovery','settings']){await go(page,route);await capture(route.replace('/','-'));}
    await startMonday(page);await capture('logger');const log=await page.getByRole('button',{name:'Log set 1',exact:true}).boundingBox();expect(log!.y+log!.height).toBeLessThanOrEqual(height);
    await page.getByLabel('Set 1 weight in kg').fill('12');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await capture('rest');await page.getByRole('button',{name:'Review and finish workout'}).click();await capture('review');await page.getByRole('button',{name:'Continue workout'}).click();await discard(page);
  }
  await page.setViewportSize({width:320,height:568});await startMonday(page);await page.getByLabel('Set 1 weight in kg').fill('12');await page.getByRole('button',{name:'Log set 1',exact:true}).click();await page.setViewportSize({width:320,height:330});await page.getByLabel('Set 2 weight in kg').focus();await page.getByLabel('Set 2 weight in kg').scrollIntoViewIfNeeded();const input=await page.getByLabel('Set 2 weight in kg').boundingBox(),dock=await page.locator('.workout-dock').boundingBox();expect(input!.y+input!.height).toBeLessThanOrEqual(dock!.y);await page.setViewportSize({width:390,height:844});
  await page.addStyleTag({content:'main p, main label, main button, .summary-link small {font-size:20px !important}'});await go(page,'today');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('rest suggestions and Progress fit phone, tablet and desktop layouts',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop','One responsive capture matrix.');
  await page.clock.setFixedTime(new Date('2026-11-04T10:00:00Z'));await seed(page,atWeek(1));
  await fs.mkdir('artifacts/recovery-removal',{recursive:true});
  for(const [width,height] of [[320,568],[390,844],[768,1000],[1440,1000]]) {
    await page.setViewportSize({width,height});
    for(const route of ['today','programme','progress']) {
      await go(page,route);if(route==='programme')await page.getByRole('tab',{name:'Wed Active recovery',exact:true}).click();
      if(route==='progress')await expect(page.getByRole('heading',{name:'Volume & load',exact:true})).toBeVisible();
      else await expect(page.getByRole('list',{name:'Optional rest-day activities'})).toHaveText('MobilityRunningWalking');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
      await page.screenshot({path:`artifacts/recovery-removal/${route}-${width}.png`,fullPage:true});
    }
  }
});

test('exercise details show the last two logged sets for the selected variation', async ({ page }) => {
  const store = atWeek(5);
  const older = savedWorkout(store, 2), newer = savedWorkout(store, 2);
  older.date = '2026-10-01';
  newer.date = '2026-10-02';
  newer.exercises[0].sets.forEach(set => { set.done = false; });
  Object.assign(newer.exercises[0].sets[0], { done: true, weight: 50, reps: 8, rir: 2 });
  const beltStore = structuredClone(store);
  beltStore.programme.options.choices['lower-a:squat'] = { variantId:'p16-belt-squat', supportCm:null, coreLevel:'Basic' };
  const belt = savedWorkout(beltStore, 2);
  belt.date = '2026-10-03';
  belt.exercises[0].sets.forEach(set => { set.done = false; });
  Object.assign(belt.exercises[0].sets[0], { done: true, weight: 60, reps: 9 });
  store.sessions = [older, newer, belt];
  await seed(page, store);
  await go(page, 'programme');
  await page.getByRole('tab', { name:'Tue Lower A', exact:true }).click();
  await page.getByRole('button', { name:/Leg Press/ }).click();

  const details = page.getByRole('dialog');
  const recent = details.getByRole('region', { name:'Last two logged sets' });
  await expect(details.getByLabel('Equipment / setup')).toHaveCount(0);
  await expect(recent.getByRole('listitem')).toHaveCount(2);
  await expect(recent.getByRole('listitem').first()).toContainText('50 kg × 8 reps · 2 RIR');
  await expect(recent.getByRole('listitem').last()).toContainText('1 Oct 2026');
  await details.getByLabel('Exercise variation').selectOption('p16-belt-squat');
  await expect(recent.getByRole('listitem')).toHaveCount(1);
  await expect(recent.getByRole('listitem')).toContainText('60 kg × 9 reps');
});

test('recent sets label assistance and timed bodyweight in the exercise sheet', async ({ page }) => {
  const store = atWeek(5);
  store.sessions = [savedWorkout(store, 4)];
  await seed(page, store);
  await go(page, 'programme');
  await page.getByRole('tab', { name:'Thu Upper B', exact:true }).click();
  await page.getByRole('button', { name:/Assisted Pull-Ups/ }).click();

  const recent = page.getByRole('region', { name:'Last two logged sets' });
  await expect(recent.getByRole('listitem').first()).toContainText('12 kg assistance');
  await close(page);
  await page.getByRole('button', { name:/Side Plank/ }).click();
  await expect(recent.getByRole('listitem').first()).toContainText(/Bodyweight × \d+ sec \/ side/);
});
