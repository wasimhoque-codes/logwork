import { useState, useRef, useEffect, useCallback, type SetStateAction } from 'react';
import { readStore, saveStore, type Store } from '../model';
import { SyncEngine, type SyncStatus } from './sync';

export function useTrainingStore() {
  const [initial]=useState(readStore);
  const [store,setView]=useState(initial.store), [ready,setReady]=useState(false), [error,setError]=useState(initial.error??''), [status,setStatus]=useState<SyncStatus>('opening');
  const [doc,setDocument]=useState<SyncEngine['current']>();
  const [syncError,setSyncError]=useState('');
  const ref=useRef(store), engineRef=useRef<SyncEngine|null>(null), pending=useRef(0), unsaved=useRef(false), chain=useRef(Promise.resolve());
  useEffect(()=>{
    const engine=new SyncEngine();engineRef.current=engine;let mounted=true;
    const unsubscribe=engine.subscribe(()=>{
      if(!mounted)return;
      setStatus(engine.status);setDocument(engine.current);
      if(engine.current&&pending.current===0&&!unsaved.current) {ref.current=engine.current.store;setView(engine.current.store);}
      setSyncError(engine.error);
    });
    const sync=()=>{if(!unsaved.current&&document.visibilityState!=='hidden')void engine.sync();};
    void engine.open(initial.store,!!initial.corrupt).then(()=>{if(!mounted){engine.close();return;}setReady(true);if(!engine.current?.blocked){setError('');try{saveStore(engine.current!.store);}catch{/* IndexedDB is authoritative. */}}sync();}).catch(()=>{if(mounted){setError('Browser database is unavailable. Export a backup before closing; changes cannot be saved.');setReady(true);setStatus('error');}});
    window.addEventListener('online',sync);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);
    const interval=setInterval(sync,30000);
    return()=>{mounted=false;unsubscribe();clearInterval(interval);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);engine.close();engineRef.current=null;};
  // Only bootstrap once; the engine owns all subsequent local and remote state.
  },[initial]);
  const setStore=useCallback((action:SetStateAction<Store>):Promise<void>=>{
    const before=ref.current, after=typeof action==='function'?action(before):action;
    ref.current=after;setView(after);pending.current++;
    let saved=false;
    const task=chain.current.then(async()=>{
      if(!engineRef.current?.current)throw new Error('Browser database is unavailable. Export a backup before closing.');
      await engineRef.current.edit(unsaved.current?engineRef.current.current.store:before,after);saved=true;unsaved.current=false;setError('');
      // Compatibility copy for existing v4 exports and old tabs. IndexedDB is authoritative.
      try{saveStore(engineRef.current.current!.store);}catch{/* The durable IndexedDB write already succeeded. */}
    });
    chain.current=task.catch(()=>{});
    const result=task.catch(error=>{unsaved.current=true;setError('Changes could not be saved on this device. Export a backup before closing.');setStatus('error');throw error;}).finally(()=>{
      pending.current--;
      if(saved&&!pending.current&&engineRef.current?.current){ref.current=engineRef.current.current.store;setView(ref.current);}
    });
    void result.catch(()=>{});return result;
  },[]);
  const restore=useCallback(async(value:Store)=>{
    await chain.current;
    if(!engineRef.current?.current)throw new Error('Browser database is unavailable.');
    await engineRef.current.restore(value);unsaved.current=false;setError('');ref.current=value;setView(value);
    try{saveStore(value);}catch{/* IndexedDB is authoritative. */}
  },[]);
  return {store,setStore,ready,error,syncError,status,blocked:doc?.blocked??!!initial.corrupt,conflicts:doc?.conflicts??[],base:doc?.base,remote:doc?.remote,restore,sync:()=>void engineRef.current?.sync(),resolve:(key:string,choice:'local'|'server')=>engineRef.current?.resolve(key,choice)};
}
