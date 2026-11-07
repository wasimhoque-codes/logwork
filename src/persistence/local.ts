import type { Store } from '../model';
import type { Snapshot, Mutation } from './records';

export type LocalDocument = {
  store: Store;
  base: Snapshot | null;
  blocked: boolean;
  conflicts: string[];
  remote?: Snapshot;
  flight?: { mutation: Mutation; target: Store; baseline?:Snapshot };
  restore?: { expected: Snapshot; stageId?: string; target:Store };
};
const NAME='gym-hawk-sync-v1';
export class LocalDatabase {
  private db?:IDBDatabase;
  constructor(private name=NAME){}
  async open() {
    if(this.db)return;
    this.db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open(this.name,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('state');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  }
  async update(fn:(value:LocalDocument|undefined)=>LocalDocument):Promise<LocalDocument> {
    await this.open();
    return new Promise((resolve,reject)=>{
      const transaction=this.db!.transaction('state','readwrite'), store=transaction.objectStore('state');
      let value:LocalDocument;
      const request=store.get('training');
      request.onsuccess=()=>{try{value=fn(request.result as LocalDocument|undefined);store.put(value,'training');}catch(error){reject(error);transaction.abort();}};
      transaction.oncomplete=()=>resolve(value);
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error??new Error('Could not save to browser storage.'));
    });
  }
  async read():Promise<LocalDocument|undefined> {
    await this.open();
    return new Promise((resolve,reject)=>{
      const r=this.db!.transaction('state').objectStore('state').get('training');
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
  }
  close(){this.db?.close();this.db=undefined;}
}
