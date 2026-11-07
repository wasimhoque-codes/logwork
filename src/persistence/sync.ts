import { validateStore, type Store } from '../model';
import { LocalDatabase, type LocalDocument } from './local';
import { changesBetween, overlay, records, type Snapshot, type Change, type Mutation } from './records';

export type SyncStatus='opening'|'saving'|'local'|'syncing'|'synced'|'signin'|'conflict'|'error';
export class RequestError extends Error {constructor(public status:number,public result:{error?:string;snapshot?:Snapshot;conflicts?:string[]}){super(result.error??'Could not connect.');}}
export type Transport=(path:string,body?:unknown)=>Promise<unknown>;
export const httpTransport:Transport=async(path,body)=>{
  const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',redirect:'manual',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(response.type==='opaqueredirect'||response.status===401||response.status===403)throw new RequestError(401,{error:'Sign in to sync. Your local changes are retained.'});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new RequestError(401,{error:'Sign in to sync. Your local changes are retained.'});
  const result=await response.json();if(!response.ok)throw new RequestError(response.status,result);return result;
};
const emptySnapshot:Snapshot={datasetId:null,revision:0,versions:{},store:null};
function meaningful(s:Store) {return !!(s.active||s.sessions.length||s.body.length||s.recovery.length||s.settings.name||s.settings.unit!=='kg'||!s.settings.autoRest||s.programme.week!==1||s.programme.attempts.length>1||Object.keys(s.programme.options.choices).length||s.programme.options.saturdayTwoSets||s.programme.options.saturdayCore!=='none'||s.programme.options.extraSlot);}

export function reconcile(doc:LocalDocument,remote:Snapshot):LocalDocument {
  if(doc.blocked)return doc;
  if(!remote.store)return doc;
  if(!doc.base?.store) {
    if(meaningful(doc.store))return {...doc,remote,conflicts:['dataset']};
    return {...doc,store:remote.store,base:remote,conflicts:[],remote:undefined};
  }
  const dirty=changesBetween(doc.base.store,doc.store,doc.base.versions);
  if(remote.datasetId!==doc.base.datasetId) {
    if(dirty.length||doc.restore)return {...doc,remote,conflicts:['dataset']};
    return {...doc,base:remote,store:remote.store,conflicts:[],remote:undefined};
  }
  if(doc.restore)return {...doc,remote};
  const conflicting=dirty.filter(c=>(remote.versions[c.key]??0)!==c.expected).map(c=>c.key);
  if(dirty.some(c=>c.key==='active'||c.key.startsWith('session:'))&&remote.versions.programme!==doc.base.versions.programme)conflicting.push(...dirty.filter(c=>c.key==='active'||c.key.startsWith('session:')).map(c=>c.key));
  try {
    return {...doc,store:overlay(remote.store,dirty),base:remote,conflicts:[...new Set([...doc.conflicts,...conflicting])],remote:undefined};
  } catch {return {...doc,remote,conflicts:['dataset']};}
}

export class SyncEngine {
  current?:LocalDocument;
  status:SyncStatus='opening';
  error='';
  private listeners=new Set<()=>void>();
  private running?:Promise<void>;
  private channel?:BroadcastChannel;
  private timer?:ReturnType<typeof setTimeout>;
  constructor(public local=new LocalDatabase(),private transport:Transport=httpTransport){}
  subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
  private emit(){this.listeners.forEach(fn=>fn());}
  private async update(fn:(doc:LocalDocument)=>LocalDocument) {
    this.current=await this.local.update(doc=>fn(doc!));this.emit();this.channel?.postMessage('changed');return this.current;
  }
  async open(store:Store,blocked=false) {
    this.current=await this.local.update(doc=>doc??{store,base:null,blocked,conflicts:[]});
    if(typeof BroadcastChannel!=='undefined') {
      this.channel=new BroadcastChannel('gym-hawk-sync');
      this.channel.onmessage=()=>{void this.refresh();};
    }
    this.status='local';this.emit();
  }
  async refresh(){const doc=await this.local.read();if(doc){this.current=doc;this.emit();}}
  async edit(before:Store,after:Store) {
    this.status='saving';this.emit();
    const changes=changesBetween(before,after);
    if(!changes.length)return;
    await this.update(doc=>({...doc,store:overlay(doc.store,changes)}));
    this.status='local';this.emit();this.schedule();
  }
  async restore(store:Store) {
    const valid=validateStore(store);
    await this.update(doc=>({...doc,store:valid,blocked:false,flight:undefined,conflicts:[],remote:undefined,restore:{expected:doc.base??emptySnapshot,target:valid}}));
    this.status='local';this.emit();this.schedule();
  }
  async resolve(key:string,choice:'local'|'server') {
    await this.update(doc=>{
      if(key==='dataset') {
        const remote=doc.remote??doc.base??emptySnapshot;
        if(choice==='server'&&remote.store)return {...doc,base:remote,store:remote.store,conflicts:[],remote:undefined,flight:undefined,restore:undefined};
        return {...doc,base:remote,conflicts:[],remote:undefined,flight:undefined,restore:{expected:remote,target:doc.store}};
      }
      let store=doc.store;
      if(choice==='server'&&doc.base?.store) {
        const server=records(doc.base.store);
        store=overlay(store,[{key,expected:0,...(key in server?{value:server[key]}:{})}]);
      }
      return {...doc,store,conflicts:doc.conflicts.filter(k=>k!==key)};
    });
    this.status=this.current!.conflicts.length?'conflict':'local';this.emit();this.schedule();
  }
  schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.sync(),600);}
  async sync() {
    if(this.running)return this.running;
    this.running=(async()=>{
      try {
        const run=async()=>{await this.refresh();if(this.current?.blocked)return;this.status='syncing';this.error='';this.emit();await this.perform();};
        if(typeof navigator!=='undefined'&&navigator.locks)await navigator.locks.request('gym-hawk-network-sync',run);else await run();
      } catch(error) {
        if(error instanceof RequestError&&error.status===409&&error.result.snapshot) {
          await this.update(doc=>{const merged=reconcile({...doc,flight:undefined},error.result.snapshot!);return {...merged,conflicts:[...new Set([...merged.conflicts,...(error.result.conflicts??[])])]};});
          this.status=this.current!.conflicts.length?'conflict':'local';
          if(!this.current!.conflicts.length)this.schedule();
        } else {this.status=error instanceof RequestError&&error.status===401?'signin':typeof navigator!=='undefined'&&!navigator.onLine?'local':'error';this.error=error instanceof Error?error.message:'Sync unavailable. Your local changes are retained.';}
      } finally {this.emit();this.running=undefined;}
    })();
    return this.running;
  }
  private async perform() {
    // Replaying the exact saved request after a lost response is safe and idempotent.
    if(this.current!.flight)await this.sendFlight();
    const remote=await this.transport('bootstrap') as Snapshot;
    await this.update(doc=>reconcile(doc,remote));
    if(this.current!.conflicts.includes('dataset')){this.status='conflict';return;}
    if(!remote.store&&!this.current!.restore)await this.update(doc=>({...doc,restore:{expected:remote,target:doc.store}}));
    if(this.current!.restore){await this.uploadRestore();return;}
    const doc=this.current!;
    if(!doc.base?.store)return;
    const pending=changesBetween(doc.base.store,doc.store,doc.base.versions).filter(c=>!doc.conflicts.includes(c.key));
    if(pending.length) {
      // Bound each request and persist its exact content before it leaves the device.
      const changes=pending.slice(0,200), mutation:Mutation={id:crypto.randomUUID(),datasetId:doc.base.datasetId!,programmeVersion:doc.base.versions.programme??0,changes};
      await this.update(d=>({...d,flight:{mutation,target:overlay(d.base!.store!,changes),baseline:d.base!}}));
      await this.sendFlight();
      this.schedule();
    }
    this.status=this.current!.conflicts.length?'conflict':changesBetween(this.current!.base!.store!,this.current!.store).length?'local':'synced';
  }
  private async sendFlight() {
    const flight=this.current!.flight!;
    const response=await this.transport('mutations',flight.mutation) as Snapshot;
    await this.update(doc=>{
      const later=changesBetween(flight.target,doc.store);
      const changedAgain=later.filter(c=>{
        const sent=flight.mutation.changes.find(s=>s.key===c.key);
        const expected=sent?sent.expected+1:(flight.baseline??doc.base)?.versions[c.key]??0;
        return (response.versions[c.key]??0)!==expected;
      }).map(c=>c.key);
      try {return {...doc,base:response,store:overlay(response.store!,later),conflicts:[...new Set([...doc.conflicts,...changedAgain])],flight:undefined};}
      catch {return {...doc,remote:response,conflicts:['dataset'],flight:undefined};}
    });
  }
  private async uploadRestore() {
    let doc=this.current!, restore=doc.restore!;
    if(!restore.stageId) {
      const result=await this.transport('imports',{action:'create',expectedDatasetId:restore.expected.datasetId,expectedRevision:restore.expected.revision}) as {id:string};
      await this.update(d=>({...d,restore:{...d.restore!,stageId:result.id}}));
    }
    doc=this.current!;restore=doc.restore!;
    const target=structuredClone(restore.target);
    const changes:Change[]=Object.entries(records(target)).map(([key,value])=>({key,value,expected:0,...(key.startsWith('session:')?{position:target.sessions.findIndex(s=>'session:'+s.id===key)}:key.startsWith('body:')?{position:target.body.findIndex(b=>'body:'+b.date===key)}:key.startsWith('recovery:')?{position:target.recovery.findIndex(r=>'recovery:'+r.id===key)}:{})}));
    // Re-uploading a stage from the start is safe after reload, and preserves ordering.
    for(let cursor=0;cursor<changes.length;cursor+=20) {
      await this.transport('imports',{action:'chunk',id:restore.stageId,header:{settings:target.settings,programme:target.programme},changes:changes.slice(cursor,cursor+20)});
    }
    const response=await this.transport('imports',{action:'activate',id:restore.stageId}) as Snapshot;
    await this.update(d=>({...d,base:response,store:overlay(response.store!,changesBetween(target,d.store)),restore:undefined,conflicts:[],remote:undefined}));
    this.status=changesBetween(this.current!.base!.store!,this.current!.store).length?'local':'synced';this.schedule();
  }
  close(){clearTimeout(this.timer);this.channel?.close();this.local.close();}
}
