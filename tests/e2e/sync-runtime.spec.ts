import { test, expect } from '@playwright/test';
import { records } from '../../src/persistence/records';
import type { Snapshot } from '../../src/persistence/records';

test('Workers D1 syncs devices, retains offline conflicts and resumes after sign-in',async({browser,baseURL},info)=>{
  test.skip(info.project.name!=='desktop','One isolated runtime exercise.');test.skip(!['127.0.0.1','localhost'].includes(new URL(baseURL!).hostname),'Runtime mutations use local D1 only.');test.setTimeout(30000);
  const a=await browser.newContext(),b=await browser.newContext(),pageA=await a.newPage(),pageB=await b.newPage();
  const url=baseURL!;
  let initial=await (await a.request.get(url+'/api/bootstrap')).json() as Snapshot;
  if(!initial.store){const boot=await a.newPage();await boot.goto(url);await expect(boot.getByText('Synced',{exact:true})).toBeVisible();await boot.close();initial=await(await a.request.get(url+'/api/bootstrap')).json() as Snapshot;}
  expect(initial.store).not.toBeNull();
  try {
    await pageA.goto(url+'/#settings');await pageB.goto(url+'/#settings');
    await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();await expect(pageB.getByText('Synced',{exact:true})).toBeVisible();
    await pageA.getByRole('textbox',{name:'What should we call you?'}).fill('Sync check A');await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();
    await pageB.getByRole('button',{name:'Sync now',exact:true}).click();await expect(pageB.getByRole('textbox',{name:'What should we call you?'})).toHaveValue('Sync check A');
    await a.setOffline(true);await pageA.getByRole('textbox',{name:'What should we call you?'}).fill('Offline choice');
    await pageB.getByRole('textbox',{name:'What should we call you?'}).fill('Cloud choice');await expect(pageB.getByText('Synced',{exact:true})).toBeVisible();
    await a.setOffline(false);await pageA.bringToFront();await pageA.getByRole('button',{name:'Review changes'}).click();
    await expect(pageA.getByRole('dialog')).toContainText('Offline choice');await expect(pageA.getByRole('dialog')).toContainText('Cloud choice');
    await pageA.getByRole('button',{name:'Keep this device'}).click();await pageA.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();
    expect((await (await a.request.get(url+'/api/bootstrap')).json() as Snapshot).store!.settings.name).toBe('Offline choice');
    await pageA.route('**/api/{bootstrap,mutations,imports,backup}',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"Sign in"}'}));
    await pageA.getByRole('textbox',{name:'What should we call you?'}).fill('After sign-in');await expect(pageA.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
    await pageA.unroute('**/api/{bootstrap,mutations,imports,backup}');await pageA.reload();await expect(pageA.getByText('Synced',{exact:true})).toBeVisible();
    expect((await (await a.request.get(url+'/api/bootstrap')).json() as Snapshot).store!.settings.name).toBe('After sign-in');
  } finally {
    await a.setOffline(false);await pageA.unroute('**/api/{bootstrap,mutations,imports,backup}');
    const current=await (await a.request.get(url+'/api/bootstrap')).json() as Snapshot;
    const headers={origin:url};
    const create=await a.request.post(url+'/api/imports',{headers,data:{action:'create',expectedDatasetId:current.datasetId,expectedRevision:current.revision}});expect(create.ok()).toBe(true);
    const {id}=await create.json();
    const changes=Object.entries(records(initial.store!)).map(([key,value])=>({key,value,expected:0,...(key.startsWith('session:')?{position:initial.store!.sessions.findIndex(s=>'session:'+s.id===key)}:key.startsWith('body:')?{position:initial.store!.body.findIndex(s=>'body:'+s.date===key)}:key.startsWith('recovery:')?{position:initial.store!.recovery.findIndex(s=>'recovery:'+s.id===key)}:{})}));
    for(let i=0;i<changes.length;i+=20){const chunk=await a.request.post(url+'/api/imports',{headers,data:{action:'chunk',id,header:{settings:initial.store!.settings,programme:initial.store!.programme},changes:changes.slice(i,i+20)}});expect(chunk.ok()).toBe(true);}
    expect((await a.request.post(url+'/api/imports',{headers,data:{action:'activate',id}})).ok()).toBe(true);
    await a.close();await b.close();
  }
});
