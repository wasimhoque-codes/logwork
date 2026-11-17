import { test, expect, type Page } from './fixture';
import { freshStore, localDate, newSession, validateStore } from '../../src/model';
import { fixedWorkoutForDay } from '../../src/data';
import fs from 'node:fs/promises';

const day=new Date(2026,10,17,12);
const close=async(page:Page)=>page.getByRole('dialog').getByRole('button',{name:'Close dialog'}).click();

test('set logging waits for the local transaction and retries without advancing',async({page})=>{
  await page.clock.setFixedTime(day);
  await page.addInitScript(()=>{
    const state=window as Window&{auditWrite?:'hold'|'release'|'fail';waitingForSet?:boolean;setAttempts?:number};
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){
      const done=value?.store?.active?.exercises?.[0]?.sets?.[0]?.done;
      if(!done||(state.auditWrite!=='hold'&&state.auditWrite!=='fail'))return put.call(this,value,key);
      state.setAttempts=(state.setAttempts??0)+1;
      if(state.auditWrite==='fail'){
        state.auditWrite='release';
        throw new DOMException('Quota exceeded','QuotaExceededError');
      }
      state.waitingForSet=true;
      // Keep the transaction active until the test releases the pending write.
      const request=this.get(key!);
      function wait(this:IDBRequest){
        if(state.auditWrite==='hold')(request.source as IDBObjectStore).get(key!).onsuccess=wait;
        else put.call(request.source as IDBObjectStore,value,key);
      }
      request.onsuccess=wait;
      return request;
    };
  });
  await page.goto('/#today');
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Set 1 weight in kg'}).fill('35');
  await page.getByLabel('Set 1 RIR').selectOption('2');
  await page.evaluate(()=>Object.assign(window,{auditWrite:'hold'}));
  const log=page.getByRole('button',{name:'Log set 1',exact:true});
  await log.evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  await page.waitForFunction(()=>Reflect.get(window,'waitingForSet'));
  await expect(page.getByRole('button',{name:'Saving set…'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Review and finish workout'})).toBeDisabled();
  await expect(page.locator('.session-meta')).toContainText('0 of 14 sets');
  expect(await page.evaluate(()=>Reflect.get(window,'setAttempts'))).toBe(1);
  await page.evaluate(()=>Object.assign(window,{auditWrite:'release'}));
  await expect(page.getByRole('status',{name:''}).filter({hasText:'35 kg × 8 reps saved on this device'})).toBeVisible();
  await page.getByRole('button',{name:'Undo last set'}).click();
  await expect(log).toBeVisible();
  await page.evaluate(()=>Object.assign(window,{auditWrite:'fail'}));
  await log.click();
  await expect(page.locator('.set-feedback[role=alert]')).toContainText('Could not save this set');
  await expect(page.getByRole('spinbutton',{name:'Set 1 weight in kg'})).toHaveValue('35');
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('button',{name:'Log set 2',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.locator('.session-meta')).toContainText('1 of 14 sets');
  await expect(page.getByRole('group',{name:'Rest timer'})).toContainText('2:00');
});

test('carry warm-up, substitute one exercise, skip a set, and edit the saved backdated workout',async({page})=>{
  await page.clock.setFixedTime(day);
  await page.goto('/#programme');
  await page.getByText('Preparation & guidance',{exact:true}).click();
  await page.getByRole('button',{name:'Warm-up',exact:true}).click();
  await page.getByRole('dialog').getByRole('checkbox').first().check();
  await close(page);
  await page.getByRole('button',{name:'Train this session today'}).click();
  await page.getByRole('button',{name:'Warm-up',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeChecked();
  await close(page);
  await page.getByRole('button',{name:'More exercise options'}).click();
  await page.getByRole('button',{name:'Swap for this session'}).click();
  await page.getByLabel('Exercise variation').selectOption('p16-belt-squat');
  await expect(page.getByRole('region',{name:'Last two logged sets'})).toContainText('No logged sets yet');
  await page.getByRole('button',{name:'Use this exercise'}).click();
  await expect(page.getByRole('heading',{name:'Belt Squat',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Belt Squat',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Skip set',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Set 2 weight in kg'}).fill('30');
  await page.getByRole('button',{name:'Log set 2',exact:true}).click();
  await page.getByRole('button',{name:'Review and finish workout'}).click();
  await page.getByText('Unfinished sets',{exact:true}).click();
  await page.getByRole('button',{name:/Belt Squat.*1 skipped/}).click();
  await expect(page.getByRole('group',{name:'Current working set'})).toContainText('Set 1');
  await page.getByRole('button',{name:'Review and finish workout'}).click();
  await page.getByLabel('Workout date').fill('2026-11-15');
  await page.getByRole('button',{name:'Save workout',exact:true}).click();
  await page.getByRole('button',{name:'View workout',exact:true}).click();
  const detail=page.getByRole('dialog');
  await expect(detail).toContainText('15 November 2026');
  await expect(detail).toContainText('Skipped');
  await detail.getByRole('button',{name:'Edit date'}).click();
  await detail.getByLabel('Workout date').fill('2026-11-16');
  await detail.getByLabel('Belt Squat set 2 RIR').selectOption('2');
  await detail.getByLabel('Belt Squat notes').fill('Use Station 2 again.');
  await detail.getByRole('button',{name:'Save changes'}).click();
  await expect(detail).toContainText('16 November 2026');
  await expect(detail).toContainText('2 RIR');
  await detail.getByRole('button',{name:'Back to previous screen'}).click();
  await page.goto('/#settings');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export backup'}).click();
  const store=validateStore(JSON.parse(await fs.readFile((await(await download).path())!,'utf8')));
  expect(store.sessions[0].workout.exercises[0].name).toBe('Belt Squat');
  expect(fixedWorkoutForDay(2,store.programme.options)?.exercises[0].name).toBe('Leg Press');
});

test('progress shows recent weeks and the set that produced the highest strength estimate',async({page})=>{
  await page.clock.setFixedTime(day);
  const store=freshStore();
  const template=fixedWorkoutForDay(2,store.programme.options)!;
  for(const [days,weight,reps] of [[0,60,10],[12,62.5,5],[100,50,10]]){
    const date=new Date(day);
    date.setDate(date.getDate()-days);
    const session=newSession(template,store);
    session.date=localDate(date);session.startedAt=date.getTime();session.endedAt=session.startedAt+60_000;
    Object.assign(session.exercises[0].sets[0],{weight,reps,rir:2,done:true});
    if(!days)Object.assign(session.exercises[0].sets[1],{weight:62.5,reps:5,done:true});
    store.sessions.push(session);
  }
  await page.addInitScript(raw=>localStorage.setItem('gym-hawk-v4',raw),JSON.stringify(store));
  await page.goto('/#progress');
  await expect(page.locator('[data-week]')).toHaveCount(8);
  await page.getByLabel('Weekly date range').selectOption('all');
  await expect.poll(()=>page.locator('[data-week]').count()).toBeGreaterThan(8);
  await page.locator('[data-week]').last().focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.weekly-selection')).toContainText('0 sessions');
  await page.getByRole('tab',{name:'Exercises',exact:true}).click();
  await page.getByRole('button',{name:/View details for Leg Press/}).click();
  await expect(page.getByRole('heading',{name:'Leg Press',level:1})).toBeVisible();
  await page.getByLabel('Metric').selectOption('estimate');
  await expect(page.locator('.selected-workout-stats')).toContainText('80 kg');
  await expect(page.locator('.estimate-source')).toContainText('60 kg × 10 reps · 2 RIR');
  await page.getByLabel('Metric').selectOption('reps');
  await page.getByRole('combobox',{name:'Load',exact:true}).selectOption('60');
  await page.getByRole('button',{name:'Previous date'}).click();
  await expect(page.locator('.selected-workout')).toContainText('No sets at the selected load');
});


test('edit a weigh-in and use manual rest and a separate timed hold',async({page})=>{
  await page.clock.install({time:day});
  const store=freshStore();
  store.settings.autoRest=false;
  store.body=[{id:'weigh-in',date:'2026-11-15',kg:71}];
  await page.addInitScript(raw=>localStorage.setItem('gym-hawk-v4',raw),JSON.stringify(store));
  await page.goto('/#progress/bodyweight');
  await page.getByRole('button',{name:'Edit bodyweight for 2026-11-15'}).click();
  await expect(page.getByLabel('Bodyweight (kg)')).toHaveValue('71');
  await page.getByLabel('Date',{exact:true}).fill('2026-11-16');
  await page.getByLabel('Bodyweight (kg)').fill('71.5');
  await page.getByRole('button',{name:'Save bodyweight'}).click();
  await expect(page.getByRole('button',{name:'Edit bodyweight for 2026-11-16'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit bodyweight for 2026-11-15'})).toHaveCount(0);
  await page.getByRole('button',{name:'Programme',exact:true}).click();
  await page.getByRole('tab',{name:'Thu Upper B'}).click();
  await page.getByRole('button',{name:'Train this session today'}).click();
  await page.getByRole('button',{name:'Start rest'}).click();
  await expect(page.getByRole('group',{name:'Rest timer'})).toBeVisible();
  await page.getByRole('button',{name:/Exercise 1 of/}).click();
  await page.getByRole('dialog').getByRole('button',{name:/Side Plank/}).click();
  const stopwatch=page.getByRole('group',{name:'Hold stopwatch'});
  await stopwatch.getByRole('button',{name:'Start hold'}).click();
  await page.clock.fastForward(6000);
  await stopwatch.getByRole('button',{name:'Pause hold'}).click();
  await stopwatch.getByRole('button',{name:'Use seconds'}).click();
  await expect(page.getByLabel('Set 1 seconds')).toHaveValue('6');
  await expect(page.getByRole('group',{name:'Rest timer'})).toBeVisible();
});
