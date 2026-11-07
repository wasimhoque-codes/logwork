import { useState, useEffect } from 'react';
import { Modal } from '../components';
import { type Store, type Session, type BodyEntry, type Programme, type Settings, type RecoveryEntry, number } from '../model';
import { records, type RecordValue } from './records';
import type { useTrainingStore } from './use-training-store';

function describe(key:string,value:RecordValue|undefined,store?:Store|null):string {
  if(key==='dataset')return store?`${store.sessions.length} workouts, ${store.body.length} weigh-ins · Week ${store.programme.week}`:'No cloud records';
  if(value===undefined||value===null)return key==='active'?'No active workout':'Removed';
  if(key==='programme'){const p=value as Programme;return `Week ${p.week} · ${p.attempts.length} attempts · ${p.status}`;}
  if(key==='settings'){const s=value as Settings;return `${s.name||'Your profile'} · ${s.unit} · automatic rest ${s.autoRest?'on':'off'}`;}
  if(key.startsWith('body:')){const b=value as BodyEntry;return `${b.date} · ${number(b.kg,2)} kg`;}
  if(key.startsWith('recovery:')){const r=value as RecoveryEntry;return `${r.date} · ${r.activity} · ${r.cardio+r.mobility} minutes`;}
  const s=value as Session;
  return `${s.workout.name} · ${s.date} · ${s.exercises.reduce((n,e)=>n+e.sets.filter(t=>t.done).length,0)} logged sets${s.note?' · '+s.note:''}`;
}
export function SyncPanel({persistence:p,onExport,actions=false}:{persistence:ReturnType<typeof useTrainingStore>;onExport:()=>void;actions?:boolean}) {
  const [open,setOpen]=useState(false);
  const labels={opening:'Opening records…',saving:'Saving on this device…',local:'Saved on this device',syncing:'Syncing…',synced:'Synced',signin:'Sign in to sync',conflict:'Choose which changes to keep',error:'Saved on this device · sync unavailable'};
  useEffect(()=>{
    if(process.env.NODE_ENV!=='production'||!('serviceWorker' in navigator))return;
    void navigator.serviceWorker.register('/sw.js').catch(()=>{});
  },[]);
  const server=p.remote?.store??p.base?.store;
  return <><div className="sync-strip"><span aria-live="polite" title={p.syncError}>{p.conflicts.length?'Changes need review':labels[p.status]}</span>{actions&&(p.conflicts.length?<button className="text-button" onClick={()=>setOpen(true)}>Review changes</button>:p.status==='signin'?<a href="/" className="text-button">Sign in</a>:<button className="text-button" onClick={p.sync} disabled={p.status==='syncing'||p.status==='saving'}>Sync now</button>)}</div>
    {open&&<Modal variant="sheet" title="Review changes" onClose={()=>setOpen(false)}><p>Both versions are kept until you choose. Changes to other records can still sync.</p><button className="secondary full-width" onClick={onExport}>Back up this device first</button>{p.conflicts.map(key=><section className="sync-choice" key={key}><h3>{key==='dataset'?'Different sets of records':key==='active'?'Active workout':key==='programme'?'Programme':key==='settings'?'Preferences':key.startsWith('body:')?'Bodyweight':key.startsWith('recovery:')?'Historical recovery':'Workout'}</h3><p><strong>This device:</strong> {describe(key,records(p.store)[key],p.store)}</p><p><strong>Cloud:</strong> {describe(key,server?records(server)[key]:undefined,server)}</p>{key==='dataset'&&<p>Choosing this device replaces the cloud records. Choosing the cloud replaces this device’s records.</p>}<div className="sync-choice-actions"><button className="secondary" onClick={()=>void p.resolve(key,'local')}>Keep this device</button><button className="secondary" onClick={()=>void p.resolve(key,'server')}>Keep cloud</button></div></section>)}{!p.conflicts.length&&<p role="status">Changes resolved.</p>}</Modal>}
  </>;
}
