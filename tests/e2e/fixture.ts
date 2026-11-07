import { test as base } from '@playwright/test';
export { expect, type Page } from '@playwright/test';

// Interface tests use private, device-local records. Real database/sync behavior
// is covered by database.test.ts, sync.test.ts and the runtime sync browser test.
export const test=base.extend({
  context:async({context},use)=>{
    await context.route(url=>url.pathname.startsWith('/api/'),route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Sign in to sync.'})}));
    await use(context);
  },
});
export async function replaceLocal(page:import('@playwright/test').Page,store:unknown) {
  await page.evaluate(async value=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('gym-hawk-sync-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({store:value,base:null,blocked:false,conflicts:[]},'training');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
    db.close();localStorage.setItem('gym-hawk-v4',JSON.stringify(value));
  },store);
}
