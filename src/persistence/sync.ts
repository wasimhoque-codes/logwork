import { validateStore, type Store } from '../model';
import { LocalDatabase, type LocalDocument } from './local';
import { changesBetween, compareEdits, equal, importRecords, mergeEdit, overlay, records, SYNC_PROTOCOL, type Edit, type Snapshot, type Change } from './records';

export type SyncStatus = 'opening' | 'saving' | 'local' | 'syncing' | 'synced' | 'signin' | 'update' | 'error';

export class RequestError extends Error {
  constructor(public status: number, public result: {error?: string; snapshot?: Snapshot; conflicts?: string[]}) {
    super(result.error ?? 'Could not connect.');
  }
}

export type Transport = (path: string, body?: unknown) => Promise<unknown>;
export const httpTransport: Transport = async (path, body) => {
  const response = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
    headers: {'X-Gym-Hawk-Sync':SYNC_PROTOCOL, ...(body === undefined ? {} : {'Content-Type':'application/json'})},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.type === 'opaqueredirect' || response.status === 401) {
    throw new RequestError(401, {error:'Sign in to sync. Your local changes are retained.'});
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new RequestError(response.ok ? 502 : response.status, {error:'Cloud sync is unavailable. Your local changes are retained.'});
  }
  const result = await response.json();
  if (!response.ok) throw new RequestError(response.status, result);
  return result;
};

const emptySnapshot: Snapshot = {datasetId:null, revision:0, versions:{}, store:null};

function meaningful(store: Store) {
  const options = store.programme.options;
  return !!(store.active || store.sessions.length || store.body.length || store.recovery.length ||
    store.settings.name || store.settings.unit !== 'kg' || !store.settings.autoRest ||
    store.programme.week !== 1 || store.programme.status !== 'active' || store.programme.attempts.length > 1 ||
    Object.keys(options.choices).length || options.saturdayTwoSets || options.saturdayCore !== 'none' || options.extraSlot);
}

function makeEdit(before: Store, after: Store, changes: Change[], editedAt: number): Edit {
  const attemptIds = new Set(changes.flatMap(({value}) => value && 'attemptId' in value ? [value.attemptId] : []));
  return {
    id: crypto.randomUUID(), editedAt, changes,
    ...(before.active && changes.some(change => change.key === 'active' && change.value === null) ? {activeId:before.active.id} : {}),
    attempts: after.programme.attempts.filter(attempt => attemptIds.has(attempt.id)),
  };
}

function enqueueEdit(doc:LocalDocument,before:Store,after:Store,changes:Change[],editedAt:number):LocalDocument {
  if(!changes.length) return doc;
  const store=overlay(doc.store,changes);
  const time=Math.max(editedAt,(doc.lastEditAt??0)+1);
  const queue=doc.queue??(doc.base?.store?[
    makeEdit(doc.base.store,doc.store,changesBetween(doc.base.store,doc.store,doc.base.versions),0),
  ]:[]);
  return {...doc,store,lastEditAt:time,queue:[...queue,makeEdit(before,after,changes,time)]};
}

function project(doc: LocalDocument, base: Snapshot, queue: Edit[]): LocalDocument {
  if (!base.store) return {...doc, base, queue};
  let store = base.store, clocks = base.clocks ?? {};
  for (const edit of queue) {
    ({store, clocks} = mergeEdit(store, clocks, edit));
  }
  return {...doc, base, queue, store};
}

function adopt(doc: LocalDocument, remote: Snapshot, preserve: boolean): LocalDocument {
  return {
    ...doc, base:remote, store:remote.store ?? doc.store, queue:[], restore:undefined,
    recovered: preserve ? recover(doc) : doc.recovered,
  };
}

function recover(doc: LocalDocument) {
  const recovered = doc.recovered ?? [];
  return recovered.some(copy => equal(copy, doc.store)) ? recovered : [...recovered, doc.store];
}

function reconcile(doc: LocalDocument, remote: Snapshot, acknowledged?: string): LocalDocument {
  if (doc.blocked || doc.restore) return doc;
  if (doc.base?.datasetId !== remote.datasetId) {
    if (remote.store) return adopt(doc, remote, doc.base?.store ? !!doc.queue?.length : meaningful(doc.store));
    // A missing server dataset is never permission to republish an existing local copy.
    return doc;
  }
  const base = doc.base && doc.base.revision > remote.revision ? doc.base : remote;
  const queue=doc.queue??[];
  const projected=project(doc,base,queue.filter(edit=>edit.id!==acknowledged));
  const pending=new Map<string,{edit:Edit;change:Change}>();
  for(const edit of queue) for(const change of edit.changes) pending.set(change.key,{edit,change});
  const local=records(doc.store),merged=records(projected.store);
  const replaced=[...pending.values()].some(({edit,change})=>{
    const key=change.key;
    if(!equal(change.value,local[key])||equal(local[key],merged[key]))return false;
    if(compareEdits(edit,base.clocks?.[key])<0)return true;
    return key==='active'&&doc.store.active!==null&&
      base.store?.sessions.some(session=>session.id===doc.store.active?.id);
  });
  return replaced?{...projected,recovered:recover(doc)}:projected;
}

export class SyncEngine {
  current?: LocalDocument;
  status: SyncStatus = 'opening';
  error = '';
  private listeners = new Set<() => void>();
  private running?: Promise<void>;
  private channel?: BroadcastChannel;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;

  constructor(public local = new LocalDatabase(), private transport: Transport = httpTransport) {}

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit() { this.listeners.forEach(fn => fn()); }

  private async update(fn: (doc: LocalDocument) => LocalDocument) {
    this.current = await this.local.update(doc => fn(doc!));
    this.emit();
    this.channel?.postMessage('changed');
  }

  async open(initialStore: Store, initialBlocked = false) {
    this.current = await this.local.update(doc => {
      if (!doc) return {store:initialStore, base:null, blocked:initialBlocked, queue:[]};
      if (doc.queue) return doc;

      // The previous format had no edit times. Only requeue edits known to precede timestamped writes.
      const {store, base, blocked, recovered} = doc;
      if (doc.restore) {
        return {store, base, blocked, recovered, queue:[], restore:{
          id:crypto.randomUUID(), expected:doc.restore.expected, target:doc.restore.target,
        }};
      }
      const changes = base?.store ? changesBetween(base.store, store, base.versions) : [];
      return {store, base, blocked, recovered, ...(base?.store && changes.length ? {} : {queue:[]})};
    });
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('gym-hawk-sync');
      this.channel.onmessage = () => { void this.refresh(); };
    }
    this.status = 'local';
    this.emit();
  }

  async refresh() {
    const doc = await this.local.read();
    if (doc && !this.closed) {
      this.current = doc;
      this.emit();
    }
  }

  get generation() {
    return this.current?.restore?.id ?? this.current?.base?.datasetId ?? null;
  }

  async edit(before: Store, after: Store, editedAt = Date.now(), generation = this.generation) {
    const changes = changesBetween(before, after);
    if (!changes.length) return;
    this.status = 'saving';
    this.emit();
    await this.update(doc => {
      const current = doc.restore?.id ?? doc.base?.datasetId ?? null;
      if (current !== generation) return {...doc, recovered:recover({...doc, store:after})};
      return enqueueEdit(doc, before, after, changes, editedAt);
    });
    this.status = 'local';
    this.emit();
    this.schedule();
  }

  async commit(action:(store:Store)=>Store, generation=this.generation) {
    this.status='saving';
    this.emit();
    try {
      await this.update(doc=>{
        const current=doc.restore?.id??doc.base?.datasetId??null;
        if(doc.blocked||current!==generation) throw new Error('Local records changed. Try again.');
        const after=action(doc.store);
        return enqueueEdit(doc,doc.store,after,changesBetween(doc.store,after),Date.now());
      });
    } finally {
      this.status='local';
      this.emit();
      this.schedule();
    }
  }

  async restore(store: Store) {
    const target = validateStore(store);
    await this.update(doc => ({
      ...doc, store:target, blocked:false, queue:[],
      restore:{id:crypto.randomUUID(), expected:doc.base ?? emptySnapshot, target},
    }));
    this.status = 'local';
    this.emit();
    this.schedule();
  }

  schedule() {
    if (this.closed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), 600);
  }

  async sync() {
    if (this.running || this.closed) return this.running;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.status = 'local';
      this.emit();
      return;
    }
    this.running = (async () => {
      try {
        const run = async () => {
          if (this.closed) return;
          await this.refresh();
          if (!this.current || this.current.blocked || this.closed) return;
          this.status = 'syncing';
          this.error = '';
          this.emit();
          await this.perform();
        };
        if (typeof navigator !== 'undefined' && navigator.locks) {
          await navigator.locks.request('gym-hawk-network-sync', run);
        } else {
          await run();
        }
      } catch (error) {
        this.status = error instanceof RequestError && error.status === 401 ? 'signin'
          : error instanceof RequestError && error.status === 426 ? 'update'
          : typeof navigator !== 'undefined' && navigator.onLine === false ? 'local' : 'error';
        this.error = error instanceof Error ? error.message : 'Sync unavailable. Your local changes are retained.';
      } finally {
        this.running = undefined;
        this.emit();
      }
    })();
    return this.running;
  }

  private async perform() {
    const start = this.current!.base?.datasetId;
    const remote = await this.transport('bootstrap') as Snapshot;
    await this.update(doc => {
      if (doc.base?.datasetId !== start || doc.restore) return doc;
      if (!doc.queue && doc.base?.store) {
        const changes = changesBetween(doc.base.store, doc.store, doc.base.versions);
        doc = {...doc, queue:changes.length ? [makeEdit(doc.base.store, doc.store, changes, 0)] : []};
      }
      if (remote.store && doc.base?.datasetId === remote.datasetId && doc.queue?.some(edit =>
        edit.editedAt === 0 && edit.changes.some(change => change.expected !== (remote.versions[change.key] ?? 0)))) {
        doc = {...doc, recovered:recover(doc), queue:doc.queue.filter(edit => edit.editedAt !== 0)};
      }
      if (!remote.store && !doc.base?.datasetId) {
        return {...doc, restore:{id:crypto.randomUUID(), expected:remote, target:doc.store}, queue:[]};
      }
      return reconcile(doc, remote);
    });

    if (!remote.store && start && !this.current!.restore) {
      throw new Error('Cloud records are unavailable. Local records are retained.');
    }
    if (this.current!.restore) await this.uploadRestore(this.current!.restore);
    if (!this.current!.base?.store) throw new Error('Cloud records are unavailable. Local records are retained.');

    // Drain a bounded number per pass. A queue entry is the durable request, including after a lost response.
    for (let count = 0; count < 20 && !this.closed; count++) {
      const {queue, base, restore} = this.current!;
      const edit = queue?.[0];
      if (!edit || !base?.datasetId || restore) break;
      try {
        const response = await this.transport('mutations', {...edit, datasetId:base.datasetId}) as Snapshot;
        await this.update(doc => doc.base?.datasetId === base.datasetId ? reconcile(doc, response, edit.id) : doc);
      } catch (error) {
        if (!(error instanceof RequestError) || error.status !== 409 || !error.result.snapshot) throw error;
        const next = error.result.snapshot;
        await this.update(doc => doc.base?.datasetId === base.datasetId ? reconcile(doc, next) : doc);
        break;
      }
    }
    const pending = !!(this.current!.queue?.length || this.current!.restore);
    this.status = pending ? 'local' : 'synced';
    if (pending) this.schedule();
  }

  private async uploadRestore(restore: NonNullable<LocalDocument['restore']>) {
    const {id, expected, target} = restore;
    let {stageId} = restore;
    const call = (body: object) => this.transport('imports', body);
    try {
      if (!stageId) {
        const stage = await call({action:'create', expectedDatasetId:expected.datasetId, expectedRevision:expected.revision}) as {id:string};
        stageId = stage.id;
        await this.update(doc => doc.restore?.id === id ? {...doc, restore:{...doc.restore, stageId}} : doc);
      }
      if (!restore.uploaded) {
        const changes = importRecords(target);
        for (let cursor = 0; cursor < changes.length; cursor += 5) {
          await call({action:'chunk', id:stageId, header:{settings:target.settings, programme:target.programme}, changes:changes.slice(cursor,cursor+20)});
        }
        await this.update(doc => doc.restore?.id === id ? {...doc, restore:{...doc.restore, uploaded:true}} : doc);
      }
      if (this.current!.restore?.id !== id) return;
      const response = await call({action:'activate', id:stageId}) as Snapshot;
      await this.update(doc => doc.restore?.id === id
        ? project({...doc, restore:undefined}, response, doc.queue ?? [])
        : doc);
    } catch (error) {
      if (error instanceof RequestError && error.status === 409 && error.result.snapshot?.store) {
        const remote = error.result.snapshot;
        await this.update(doc => doc.restore?.id === id ? adopt(doc, remote, true) : doc);
        throw new Error('Cloud records changed during restore. A copy was saved on this device. Open Settings to export it and retry.');
      }
      throw error;
    }
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    this.channel?.close();
    this.local.close();
  }
}
