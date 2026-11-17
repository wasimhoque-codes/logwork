import { useState, useEffect } from 'react';
import { localDate, type Store } from '../model';
import type { useTrainingStore } from './use-training-store';

function exportRecovered(store: Store, index: number) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(store, null, 2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `gym-hawk-recovered-${localDate()}-${index + 1}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SyncPanel({persistence:p,actions=false}:{persistence:ReturnType<typeof useTrainingStore>;actions?:boolean}) {
  const [cloudSession,setCloudSession]=useState<{signedIn:boolean;localDevelopment:boolean}>();
  const [signingOut,setSigningOut]=useState(false);
  const [authMessage,setAuthMessage]=useState('');
  const needsSignIn=p.status==='signin';

  useEffect(()=>{
    if(!actions)return;
    let active=true;
    let check:AbortController|undefined;
    const refresh=async()=>{
      check?.abort();
      const current=new AbortController();
      check=current;
      try {
        const response=await fetch('/api/auth/session',{cache:'no-store',signal:current.signal});
        if(response.ok){
          const value=await response.json();
          if(active&&!current.signal.aborted)setCloudSession(value);
        }
      } catch {/* Local records are still available. */}
    };
    void refresh();
    window.addEventListener('focus',refresh);
    window.addEventListener('online',refresh);
    return ()=>{
      active=false;
      check?.abort();
      window.removeEventListener('focus',refresh);
      window.removeEventListener('online',refresh);
    };
  },[actions,needsSignIn]);

  useEffect(()=>{
    if(!actions)return;
    const url=new URL(window.location.href);
    const result=url.searchParams.get('cloud-signin');
    if(!result)return;
    url.searchParams.delete('cloud-signin');
    window.history.replaceState(window.history.state,'',url);
    setAuthMessage(result==='account'
      ? 'Use the GitHub account approved for Gym Hawk.'
      : 'GitHub sign-in could not be completed. Try again.');
  },[actions]);

  async function signOut(){
    setSigningOut(true);
    setAuthMessage('');
    try {
      const response=await fetch('/api/auth/logout',{method:'POST',cache:'no-store'});
      if(!response.ok)throw new Error('Sign-out failed.');
      setCloudSession({signedIn:false,localDevelopment:false});
      p.sync();
    } catch {
      setAuthMessage('Could not sign out of cloud sync. Try again when online.');
    } finally {
      setSigningOut(false);
    }
  }
  const labels={opening:'Opening records…',saving:'Saving on this device…',local:'Saved on this device · waiting to sync',syncing:'Syncing…',synced:'Synced',signin:'Saved on this device · sign in to sync',update:'Reload to update sync',error:'Saved on this device · sync unavailable'};
  useEffect(()=>{
    if(process.env.NODE_ENV!=='production'||!('serviceWorker' in navigator))return;
    void navigator.serviceWorker.register('/sw.js').catch(()=>{});
  },[]);
  const signedOut=needsSignIn||cloudSession?.signedIn===false;
  return <>
    <div className="sync-strip">
      <span aria-live="polite" title={p.syncError}>{labels[p.status]}</span>
      {actions&&signedOut&&<a href="/api/auth/github/start" className="text-button">Sign in with GitHub</a>}
      {actions&&p.status==='update'&&<button className="text-button" onClick={()=>window.location.reload()}>Reload Gym Hawk</button>}
      {actions&&cloudSession?.signedIn&&!cloudSession.localDevelopment&&!needsSignIn&&
        <button className="text-button" onClick={()=>void signOut()} disabled={signingOut}>Sign out of cloud sync</button>}
    </div>
    {actions&&authMessage&&<p className="sync-auth-message" role="status">{authMessage}</p>}
    {actions&&p.recovered.length>0&&<div className="sync-auth-message">
      <p>Some local changes were replaced during sync or restore. Earlier copies are available to download.</p>
      {p.recovered.map((store,index)=><button key={index} className="text-button" onClick={()=>exportRecovered(store,index)}>
        {p.recovered.length===1?'Download recovered backup':`Download recovered backup ${index + 1}`}
      </button>)}
    </div>}
  </>;
}
