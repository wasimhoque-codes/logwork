import { test, expect } from './fixture';
import fs from 'node:fs/promises';

test('an IndexedDB quota failure keeps the last durable copy and unsaved changes exportable',async({page})=>{
  await page.addInitScript(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){
      if((value as {store?:{body?:unknown[]}})?.store?.body?.length)throw new DOMException('Quota exceeded','QuotaExceededError');
      return original.call(this,value,key);
    };
  });
  await page.goto('/#today');await page.getByRole('button',{name:/Log bodyweight/}).click();
  await page.getByLabel('Bodyweight (kg)',{exact:true}).fill('71');await page.getByRole('button',{name:'Save bodyweight'}).click();
  await expect(page.locator('.app-shell').getByRole('alert')).toContainText('Changes could not be saved on this device');
  await expect(page.getByRole('dialog')).toHaveCount(1);await page.getByRole('dialog').getByRole('button',{name:'Close dialog'}).click();
  await page.goto('/#settings');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();
  const backup=JSON.parse(await fs.readFile((await(await download).path())!,'utf8'));expect(backup.body[0].kg).toBe(71);
  const savedCount=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const open=indexedDB.open('gym-hawk-sync-v1');open.onsuccess=()=>{const db=open.result,r=db.transaction('state').objectStore('state').get('training');r.onsuccess=()=>{resolve(r.result.store.body.length);db.close();};r.onerror=()=>reject(r.error);};}));
  expect(savedCount).toBe(0);
});
