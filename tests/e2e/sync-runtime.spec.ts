import { test, expect } from '@playwright/test';
import { records, SYNC_PROTOCOL } from '../../src/persistence/records';
import type { Snapshot } from '../../src/persistence/records';

test('Workers D1 syncs devices, keeps the latest offline edits and resumes after sign-in',async({browser,baseURL},info)=>{
  test.skip(info.project.name!=='desktop','One isolated runtime exercise.');test.skip(!['127.0.0.1','localhost'].includes(new URL(baseURL!).hostname),'Runtime mutations use local D1 only.');test.setTimeout(30000);
  const a=await browser.newContext(),b=await browser.newContext(),pageA=await a.newPage(),pageB=await b.newPage();
  const url=baseURL!;
  const headers={origin:url,'X-Gym-Hawk-Sync':SYNC_PROTOCOL};
  const bootstrap=async()=>await(await a.request.get(url+'/api/bootstrap',{headers})).json() as Snapshot;
  expect((await a.request.get(url+'/api/bootstrap',{headers:{'X-Gym-Hawk-Sync':'2'}})).status()).toBe(426);
  let initial=await bootstrap();
  if(!initial.store){const boot=await a.newPage();await boot.goto(url);await expect(boot.getByText('Synced',{exact:true})).toBeVisible();await boot.close();initial=await bootstrap();}
  expect(initial.store).not.toBeNull();
  try {
    await pageA.goto(url+'/#settings');await pageB.goto(url+'/#settings');
    await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();await expect(pageB.getByText('Synced',{exact:true})).toBeVisible();
    await pageA.getByRole('textbox',{name:'What should we call you?'}).fill('Sync check A');await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();
    await pageB.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(pageB.getByRole('textbox',{name:'What should we call you?'})).toHaveValue('Sync check A');
    await a.setOffline(true);await pageA.getByRole('textbox',{name:'What should we call you?'}).fill('Offline choice');
    await pageB.getByRole('textbox',{name:'What should we call you?'}).fill('Cloud choice');await expect(pageB.getByText('Synced',{exact:true})).toBeVisible();
    await a.setOffline(false);await pageA.bringToFront();
    await expect(pageA.getByRole('textbox',{name:'What should we call you?'})).toHaveValue('Cloud choice');
    await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();
    expect((await bootstrap()).store!.settings.name).toBe('Cloud choice');
    await expect(pageA.getByRole('button',{name:/Download recovered backup/})).toBeVisible();
    const dataRoutes='**/api/{bootstrap,mutations,imports,backup}';
    const unauthorized=(route:import('@playwright/test').Route)=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"Sign in"}'});
    let signedIn=true;
    await pageA.route('**/api/auth/session',route=>route.fulfill({json:{signedIn,localDevelopment:false}}));
    await pageA.route('**/api/auth/logout',async route=>{
      expect(route.request().method()).toBe('POST');
      signedIn=false;
      await pageA.route(dataRoutes,unauthorized);
      await route.fulfill({json:{signedIn:false}});
    });
    await pageA.route('**/api/auth/github/start',async route=>{
      signedIn=true;
      await pageA.unroute(dataRoutes,unauthorized);
      await route.fulfill({status:303,headers:{Location:'/?auth-test=return#settings'}});
    });
    await pageA.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await pageA.getByRole('button',{name:'Sign out of cloud sync'}).click();
    await expect(pageA.getByRole('textbox',{name:'What should we call you?'})).toHaveValue('Cloud choice');
    await pageA.getByRole('textbox',{name:'What should we call you?'}).fill('After sign-in');
    const signIn=pageA.getByRole('link',{name:'Sign in with GitHub',exact:true});
    await expect(signIn).toBeVisible();
    await pageA.reload();
    await expect(pageA.getByRole('textbox',{name:'What should we call you?'})).toHaveValue('After sign-in');
    await signIn.click();
    await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();
    expect((await bootstrap()).store!.settings.name).toBe('After sign-in');

    await pageB.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Today'}).click();
    await a.setOffline(true);
    await pageA.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Programme'}).click();
    await pageA.getByRole('link', { name: 'Saturday Upper C'}).click();
    await pageA.getByRole('button',{name:'Start workout'}).click();
    await pageA.getByRole('button',{name:'Log set 1',exact:true}).click();
    await pageA.getByRole('button',{name:'Review and finish workout'}).click();
    await pageA.getByRole('button',{name:'Save workout'}).click();
    await expect(pageA.getByRole('heading',{name:'Workout saved'})).toBeVisible();
    await a.setOffline(false);
    await pageA.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();
    const saved=(await bootstrap()).store!.sessions.find(session=>session.workout.prescriptionMode==='fixed'&&session.workoutId==='optional');
    expect(saved).toBeDefined();
    expect(saved?.feedback).toBeUndefined();
    await pageB.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(pageB.getByText('Synced',{exact:true})).toBeVisible();
    const today = pageB.getByRole('region',{name:'Today’s workout'});
    await expect(today.getByRole('status')).toHaveText('Partial workout saved');
    await expect(today.getByRole('heading',{name:'Upper C'})).toBeVisible();
    await expect(today.getByRole('button',{name:'Start workout'})).toHaveCount(0);
    await pageB.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Progress'}).click();
    await pageB.getByRole('tab',{name:/^History/}).click();
    await expect(pageB.getByRole('button',{name:/Upper C Partial/})).toBeVisible();
  } finally {
    await a.setOffline(false);await pageA.unroute('**/api/{bootstrap,mutations,imports,backup}');
    const current=await bootstrap();
    const create=await a.request.post(url+'/api/imports',{headers,data:{action:'create',expectedDatasetId:current.datasetId,expectedRevision:current.revision}});expect(create.ok()).toBe(true);
    const {id}=await create.json();
    const changes=Object.entries(records(initial.store!)).map(([key,value])=>({key,value,expected:0,...(key.startsWith('session:')?{position:initial.store!.sessions.findIndex(s=>'session:'+s.id===key)}:key.startsWith('body:')?{position:initial.store!.body.findIndex(s=>'body:'+s.date===key)}:key.startsWith('recovery:')?{position:initial.store!.recovery.findIndex(s=>'recovery:'+s.id===key)}:{})}));
    for(let i=0;i<changes.length;i+=20){const chunk=await a.request.post(url+'/api/imports',{headers,data:{action:'chunk',id,header:{settings:initial.store!.settings,programme:initial.store!.programme},changes:changes.slice(i,i+20)}});expect(chunk.ok()).toBe(true);}
    expect((await a.request.post(url+'/api/imports',{headers,data:{action:'activate',id}})).ok()).toBe(true);
    await a.close();await b.close();
  }
});
