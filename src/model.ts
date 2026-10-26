import { WORKOUTS, VARIANTS, DEFAULT_OPTIONS, resolveWorkout, weekEffort, type ProgrammeOptions, type Unit, type LoadMode, type Exercise, type Workout } from './data';
export type SetLog = { weight:number|null; reps:number; rir:number|null; done:boolean };
export type ExerciseLog = { id:string; name:string; mode:LoadMode; sets:SetLog[]; note:string };
export type Symptom = 'none'|'stable'|'worse'|'radiating'|null;
export type Feedback = { before:Symptom; after:Symptom; nextDay:Symptom; nextDayDate:string|null; technique:boolean|null };
export type ResumeState = { exerciseIndex:number; restEnd:number|null; restPaused:number|null; origin?:'today'|'programme' };
export type Session = { id:string; workoutId:string; programId:'programme-16'; workout:Workout; date:string; startedAt:number; endedAt?:number; phase:'full'; exercises:ExerciseLog[]; note:string; week?:number; attemptId?:string; feedback?:Feedback; warmup?:boolean[]; cooldown?:boolean[]; resume?:ResumeState };
export type BodyEntry = { id:string; date:string; kg:number };
export type Settings = { name:string; unit:Unit; autoRest:boolean };
export type WeekAttempt = { id:string; week:number; started:string; ended?:string; decision?:'advance'|'repeat'|'complete'|'restart' };
export type Programme = { week:number; status:'active'|'complete'; attempts:WeekAttempt[]; options:ProgrammeOptions };
export type RecoveryEntry = { id:string; date:string; activity:'walking'|'cycling'; cardio:number; mobility:number; note:string; week:number; attemptId:string };
export type Store = { version:4; settings:Settings; programme:Programme; sessions:Session[]; active:Session|null; body:BodyEntry[]; daily:[]; recovery:RecoveryEntry[] };
export const STORAGE_KEY='gym-hawk-v4';
export const RETIRED_STORAGE_KEYS=['gym-hawk-v1','gym-hawk-v2','gym-hawk-v3'] as const;
export function localDate(d=new Date()) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
export function monday(d=new Date()) { const start=new Date(d);start.setHours(0,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7);return start; }
export function dateLabel(date:string,options:Intl.DateTimeFormatOptions={month:'short',day:'numeric'}) { return new Date(date+'T12:00:00').toLocaleDateString('en-GB',options); }
export const fromKg=(kg:number,unit:Unit)=>unit==='lb'?kg*2.2046226218:kg;
export const toKg=(n:number,unit:Unit)=>unit==='lb'?n/2.2046226218:n;
export function number(n:number,decimals=1) { return new Intl.NumberFormat('en-GB',{maximumFractionDigits:decimals}).format(n); }
export const emptyFeedback=():Feedback=>({before:null,after:null,nextDay:null,nextDayDate:null,technique:null});
export function freshStore():Store { return {version:4,settings:{name:'',unit:'kg',autoRest:true},programme:{week:1,status:'active',attempts:[{id:crypto.randomUUID(),week:1,started:localDate()}],options:structuredClone(DEFAULT_OPTIONS)},sessions:[],active:null,body:[],daily:[],recovery:[]}; }
export function sessionResume(session:Session):ResumeState {
  if(session.resume)return session.resume;
  const first=session.exercises.findIndex(ex=>ex.sets.some(set=>!set.done));
  return {exerciseIndex:first<0?session.exercises.length-1:first,restEnd:null,restPaused:null};
}
export function restSeconds(resume:ResumeState,now=Date.now()) {
  return resume.restPaused??(resume.restEnd===null?0:Math.max(0,Math.ceil((resume.restEnd-now)/1000)));
}
export function currentAttempt(store:Store) { return store.programme.attempts.at(-1)!; }
export function attemptSessions(store:Store,attempt=currentAttempt(store)) { return store.sessions.filter(s=>s.programId==='programme-16'&&s.attemptId===attempt.id); }
export function selectedWorkout(store:Store,day:number) {
  const w=WORKOUTS.find(w=>w.days.includes(day));
  const extraUsed=attemptSessions(store).some(s=>s.workout.exercises.some((ex,i)=>{const base=WORKOUTS.find(w=>w.id===s.workoutId)?.exercises.find(e=>e.slot===ex.slot);return base&&ex.sets>base.sets&&s.exercises[i].sets.at(-1)?.done;}));
  const options=extraUsed?{...store.programme.options,extraSlot:null}:store.programme.options;
  return w?resolveWorkout(w,store.programme.week,options):undefined;
}
export function doneSets(s:Session) { return s.exercises.flatMap(e=>e.sets).filter(set=>set.done).length; }
export function completeSession(s:Session) { return s.endedAt!==undefined&&s.exercises.length>0&&s.exercises.every(e=>e.sets.length>0&&e.sets.every(set=>set.done)); }
export function coreWorkoutCount(sessions:Session[]) { return new Set(sessions.filter(s=>s.programId==='programme-16'&&s.workout.category==='strength'&&completeSession(s)).map(s=>s.workoutId)).size; }
export function sessionWorkout(s:Session) { return s.workout; }
export function sessionLabel(s:Session) { return 'Week '+s.week; }
export function volume(s:Session) { return s.exercises.reduce((total,e,i)=>total+(e.mode==='external'&&!s.workout.exercises[i].timed?e.sets.filter(set=>set.done).reduce((n,set)=>n+(set.weight??0)*set.reps,0):0),0); }
export function exerciseKey(ex:Exercise,mode=ex.mode??'external') { return JSON.stringify([ex.id,mode,(ex.setup??'').trim().toLowerCase(),ex.supportCm??null,ex.coreLevel??'']); }
export function previousExercise(sessions:Session[],ex:Exercise,mode=ex.mode??'external') { const key=exerciseKey(ex,mode);for(const s of [...sessions].sort((a,b)=>b.startedAt-a.startedAt)) {const i=s.exercises.findIndex((log,i)=>log.sets.some(set=>set.done)&&exerciseKey(s.workout.exercises[i],log.mode)===key);if(i>=0)return s.exercises[i];} }
export function newSession(w:Workout,store:Store):Session {
  if(store.programme.status==='complete'||w.category==='recovery'||!w.exercises.length)throw new Error('Choose an available resistance workout.');
  return {id:crypto.randomUUID(),workoutId:w.id,programId:'programme-16',workout:structuredClone(w),date:localDate(),startedAt:Date.now(),resume:{exerciseIndex:0,restEnd:null,restPaused:null},phase:'full',week:store.programme.week,attemptId:currentAttempt(store).id,note:'',feedback:emptyFeedback(),warmup:Array(7).fill(false),cooldown:Array(3).fill(false),exercises:w.exercises.map(ex=>{
    const mode=ex.mode??'external',previous=previousExercise(store.sessions,ex,mode);
    return {id:ex.id,name:ex.name,mode,note:'',sets:Array.from({length:ex.sets},(_,i)=>{const last=previous?.sets.filter(set=>set.done)[i]??previous?.sets.filter(set=>set.done).at(-1);return {weight:mode==='bodyweight'?0:last?.weight??null,reps:Math.max(ex.min,Math.min(ex.max,last?.reps??ex.min)),rir:null,done:false};})};
  })};
}
export function reviewWeek(store:Store,action:'advance'|'repeat'|'restart'):Store {
  if(store.active)throw new Error('Finish or discard your active workout before reviewing the week.');
  if(action==='restart'&&store.programme.status!=='complete')throw new Error('Complete the block before restarting.');
  if(action!=='restart'&&store.programme.status==='complete')throw new Error('This block is complete.');
  const p=structuredClone(store.programme),last=p.attempts.at(-1)!;if(action!=='restart')last.ended=localDate();
  if(action==='advance'&&p.week===16) {last.decision='complete';p.status='complete';}
  else {if(action!=='restart')last.decision=action;p.week=action==='restart'?1:action==='advance'?p.week+1:p.week;p.status='active';p.attempts.push({id:crypto.randomUUID(),week:p.week,started:localDate()});if(action==='restart'){p.options.saturdayTwoSets=false;p.options.saturdayCore='none';p.options.extraSlot=null;} }
  return {...store,programme:p};
}
export const symptomWorse=(v:Symptom)=>v==='worse'||v==='radiating';
export const symptomOkay=(v:Symptom)=>v==='none'||v==='stable';
export const SYMPTOM_LABELS:Record<Exclude<Symptom,null>,string>={none:'No symptoms',stable:'Familiar, stable discomfort',worse:'Worse or sharp pain',radiating:'New leg symptoms / tingling / weakness'};
export function pendingFollowups(store:Store,today=localDate()) { return store.sessions.filter(s=>s.programId==='programme-16'&&s.date<today&&s.feedback?.nextDay===null).sort((a,b)=>b.startedAt-a.startedAt); }
export function progression(ex:Exercise,log:ExerciseLog,session:Session):{title:string;description:string}|null {
  if(session.programId!=='programme-16'||!session.week||session.week<=4||session.week===16||ex.recovery||log.sets.length!==ex.sets||log.sets.some(set=>!set.done||set.reps<ex.max))return null;
  const feedback=session.feedback;
  if(!feedback||feedback.technique!==true||!symptomOkay(feedback.after)||!symptomOkay(feedback.nextDay)||symptomWorse(feedback.before)||!feedback.nextDayDate||feedback.nextDayDate<=session.date)return null;
  const loaded=log.mode!=='bodyweight';
  if(loaded&&(log.sets[0].weight===null||log.sets.some(set=>set.weight!==log.sets[0].weight)))return null;
  if(log.sets.some(set=>set.rir!==null&&set.rir<2))return null;
  if(ex.method==='core')return {title:'Control target reached',description:'Progress hold time or limb/lever length gradually. Keep breathing and trunk control; change one core movement at a time.'};
  if(log.mode==='assistance'&&log.sets[0].weight===0)return {title:'Consider unassisted repetitions',description:'All targets met with zero machine assistance. Consolidate control, then explicitly choose the unassisted variation if appropriate.'};
  if(log.mode==='assistance')return {title:'Consider less assistance',description:'All targets met at the same machine assistance. Consider the smallest assistance reduction while keeping clean repetitions.'};
  if(ex.method==='pushup')return {title:'Consider the next push-up setup',description:'Lower hand support gradually, then consider standard or feet-elevated push-ups. Record the new setup separately.'};
  if(ex.method==='row')return {title:'Consider a more horizontal row',description:'Move the feet forward gradually while maintaining trunk control. Record the new setup separately.'};
  if(ex.method==='range')return {title:'Stable range before load',description:'Keep a stable, comfortable range and controlled repetitions before considering the smallest load increase.'};
  if(ex.method==='bridge')return {title:'Pelvic control before resistance',description:'Keep pelvic control, then consider a band or modest resistance. Record the variation separately.'};
  if(log.mode==='bodyweight')return {title:'Unassisted target reached',description:'Consolidate clean unassisted repetitions. There is no requirement to add weight or train to failure.'};
  return {title:'Consider the smallest load increase',description:'All prescribed sets met their targets at the same load. Consider the smallest available increment; keep technique and symptoms under review.'};
}
export function weekSessions(sessions:Session[],start=monday()) { const end=new Date(start);end.setDate(end.getDate()+7);return sessions.filter(s=>s.date>=localDate(start)&&s.date<localDate(end)); }
export function bodyAverages(body:BodyEntry[]) { const groups=new Map<string,number[]>();for(const b of body){const date=localDate(monday(new Date(b.date+'T12:00:00')));groups.set(date,[...(groups.get(date)??[]),b.kg]);}return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,count:values.length,kg:values.reduce((n,v)=>n+v,0)/values.length})); }
function consecutive(a:string,b:string) { const d=new Date(a+'T12:00:00');d.setDate(d.getDate()+7);return localDate(d)===b; }
export function bodyGuidance(body:BodyEntry[],today=localDate()):string {
  const averages=bodyAverages(body).filter(a=>a.date<localDate(monday(new Date(today+'T12:00:00')))),last=averages.at(-1),prev=averages.at(-2),first=averages.at(-3);
  const currentWeek=localDate(monday(new Date(today+'T12:00:00')));
  if(!last||!prev||last.count<2||prev.count<2||!consecutive(prev.date,last.date)||!consecutive(last.date,currentWeek))return 'Log morning bodyweight several times per week. Two entries in each consecutive completed week enable comparisons.';
  const gain=last.kg-prev.kg;
  if(first&&first.count>=2&&consecutive(first.date,prev.date)&&gain<=0&&prev.kg<=first.kg)return 'Average weight has not risen across two consecutive weekly comparisons. The programme suggests adding about 100–150 kcal/day.';
  if(gain>0.3)return 'Average gain is above the programme’s 0.15–0.3 kg/week target. Review intake and reduce slightly if this continues.';
  if(gain>=0.15)return 'Average gain is within the programme’s 0.15–0.3 kg/week target.';
  return 'The programme targets 0.15–0.3 kg/week. Keep recording weekly averages; review intake if weight does not rise for two or three weeks.';
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const string=(v:unknown,max=2000):v is string=>typeof v==='string'&&v.length<=max;
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(v:unknown,min:number,max:number)=>finite(v,min,max)&&Number.isInteger(v);
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&localDate(new Date(v+'T12:00:00'))===v;
const flag=(v:unknown)=>v===null||typeof v==='boolean';
const symptom=(v:unknown)=>v===null||['none','stable','worse','radiating'].includes(String(v));
function invalid():never { throw new Error('This backup contains invalid or duplicate Gym Hawk records.'); }
function unique(items:unknown[],key:string) { return new Set(items.map(v=>record(v)?v[key]:null)).size===items.length; }
function validExercise(v:unknown):v is Exercise {
  if(!record(v)||!string(v.id,100)||!string(v.name,100)||!string(v.muscle,100)||!integer(v.sets,1,10)||!integer(v.min,1,1000)||!integer(v.max,Number(v.min),1000)||!finite(v.rest,0,3600)||!string(v.rir,30)||!['upper','lower','isolation','core','carry'].includes(String(v.kind))||v.note!==undefined&&!string(v.note)||v.mode!==undefined&&!['external','bodyweight','assistance'].includes(String(v.mode)))return false;
  return ['timed','perSide','recovery'].every(k=>v[k]===undefined||typeof v[k]==='boolean');
}
function validFeedback(v:unknown,sessionDate:string) {
  return record(v)&&['before','after','nextDay'].every(k=>symptom(v[k]))&&flag(v.technique)&&(v.nextDay===null?v.nextDayDate===null:date(v.nextDayDate)&&v.nextDayDate>sessionDate&&v.nextDayDate<=localDate());
}
function validNewSession(value:unknown):boolean {
  if(!record(value)||!string(value.id,100)||value.programId!=='programme-16'||!date(value.date)||!finite(value.startedAt,0,9e12)||value.endedAt!==undefined&&!finite(value.endedAt,Number(value.startedAt),9e12)||value.phase!=='full'||!integer(value.week,1,16)||!string(value.attemptId,100)||!string(value.note)||!validFeedback(value.feedback,value.date)||!Array.isArray(value.warmup)||value.warmup.length!==7||!value.warmup.every(v=>typeof v==='boolean')||!Array.isArray(value.cooldown)||value.cooldown.length!==3||!value.cooldown.every(v=>typeof v==='boolean')||!record(value.workout)||!Array.isArray(value.exercises))return false;
  if(value.resume!==undefined){
    const r=value.resume;
    if(!record(r)||r.origin!==undefined&&!['today','programme'].includes(String(r.origin))||!integer(r.exerciseIndex,0,value.exercises.length-1)||!(r.restEnd===null||finite(r.restEnd,0,Date.now()+86400000))||!(r.restPaused===null||integer(r.restPaused,0,86400))||r.restEnd!==null&&r.restPaused!==null)return false;
  }
  const w=value.workout,template=WORKOUTS.find(w=>w.id===value.workoutId&&w.category!=='recovery');
  if(!template||w.id!==template.id||w.category!==template.category||!string(w.name,100)||!string(w.focus,200)||!string(w.subtitle,200)||!string(w.label,100)||!Array.isArray(w.days)||!w.days.every(d=>integer(d,0,6))||w.optional!==undefined&&typeof w.optional!=='boolean'||!Array.isArray(w.exercises)||w.exercises.length!==value.exercises.length||w.exercises.length<template.exercises.length||w.exercises.length>template.exercises.length+(template.optional&&Number(value.week)>=9?1:0)||template.optional&&(Number(value.week)<5||value.week===16))return false;
  const specs=w.exercises;
  if(!specs.every(validExercise)||!unique(specs,'slot'))return false;
  const fullSets:number[]=[];
  for(let i=0;i<specs.length;i++) {
    const spec=specs[i] as Exercise,base=template.exercises[i],allowed=base?VARIANTS[base.slot!]??[base]:VARIANTS['optional:core'];
    const original=allowed.find(ex=>ex.id===spec.id);
    const week=Number(value.week),limit=original?(template.optional?(i===template.exercises.length?2:week===5?1:2):week===16?2:week<=4?original.role==='core'?2:Math.min(original.sets,original.role==='main'?(week<=2?2:3):week===1?1:2):original.sets+(week>=13&&week<=15&&original.role!=='core'?1:0)):0;
    if(spec.sets>limit||spec.rir!==(spec.role==='core'?'—':weekEffort(week)))return false;
    if(!original||spec.slot!==(base?.slot??'optional:core')||spec.min!==original.min||spec.max!==original.max||spec.rest!==original.rest||spec.tempo!==original.tempo||spec.role!==original.role||spec.method!==original.method||spec.kind!==original.kind||spec.timed!==original.timed||spec.perSide!==original.perSide||spec.mode!==original.mode||!string(spec.setup,200)||!(spec.supportCm===null||finite(spec.supportCm,0,300))||!['Basic','Controlled extension','Longer lever'].includes(String(spec.coreLevel)))return false;
    fullSets.push(original.sets);
    const log=value.exercises[i];
    if(!record(log)||log.id!==spec.id||log.name!==spec.name||log.mode!==(spec.mode??'external')||!string(log.note)||!Array.isArray(log.sets)||log.sets.length!==spec.sets||!log.sets.every(set=>record(set)&&(set.weight===null||finite(set.weight,0,2000))&&integer(set.reps,set.done?1:0,1000)&&(set.rir===null||integer(set.rir,0,10))&&typeof set.done==='boolean'&&(!set.done||set.weight!==null)&&(log.mode!=='bodyweight'||set.weight===0)))return false;
  }
  const week=Number(value.week);
  if(template.optional){
    const working=specs.slice(0,template.exercises.length),sets=working[0].sets;
    if(working.some(ex=>ex.sets!==sets)||!(sets===1||week>=6&&sets===2)||specs.length>working.length&&specs.at(-1)!.sets!==2)return false;
  } else if(week===16){
    const expected=specs.map(()=>1);let remaining=Math.ceil(fullSets.reduce((n,v)=>n+v,0)/2)-expected.length;
    for(const role of ['main','accessory','core'])for(let i=0;i<specs.length&&remaining>0;i++)if(specs[i].role===role&&fullSets[i]>1){expected[i]++;remaining--;}
    if(specs.some((ex,i)=>ex.sets!==expected[i]))return false;
  } else {
    const expected=specs.map((ex,i)=>week<=4?Math.min(fullSets[i],ex.role==='core'?2:ex.role==='main'?(week<=2?2:3):week===1?1:2):fullSets[i]);
    const extras=specs.map((ex,i)=>ex.sets-expected[i]);
    if(extras.some(n=>n<0||n>1)||extras.reduce((n,v)=>n+v,0)>(week>=13&&week<=15?1:0))return false;
  }
  return true;
}
export function validateStore(value:unknown):Store {
  if(!record(value))invalid();
  if(value.version===1||value.version===2||value.version===3)throw new Error('This fresh-start release accepts only version-4 backups. Older backups cannot be restored.');
  if(value.version!==4||!record(value.settings)||!string(value.settings.name,60)||!['kg','lb'].includes(String(value.settings.unit))||typeof value.settings.autoRest!=='boolean'||!record(value.programme)||!Array.isArray(value.sessions)||value.sessions.length>10000||!Array.isArray(value.body)||value.body.length>20000||!Array.isArray(value.recovery)||value.recovery.length>20000)invalid();
  const p=value.programme;
  if(!integer(p.week,1,16)||!['active','complete'].includes(String(p.status))||!Array.isArray(p.attempts)||!p.attempts.length||p.attempts.length>10000||!unique(p.attempts,'id')||!record(p.options))invalid();
  for(let i=0;i<p.attempts.length;i++) {const a=p.attempts[i];if(!record(a)||!string(a.id,100)||!integer(a.week,1,16)||!date(a.started)||a.ended!==undefined&&(!date(a.ended)||a.ended<a.started)||a.decision!==undefined&&!['advance','repeat','complete','restart'].includes(String(a.decision))||(i<p.attempts.length-1||p.status==='complete')&&(a.ended===undefined||a.decision===undefined))invalid();}
  const last=p.attempts.at(-1) as WeekAttempt;
  if(last.week!==p.week||p.status==='complete'&&(p.week!==16||last.decision!=='complete')||p.status==='active'&&(last.ended!==undefined||last.decision!==undefined))invalid();
  const options=p.options;
  if(typeof options.saturdayTwoSets!=='boolean'||!['none','dead-bug','knee-raise'].includes(String(options.saturdayCore))||!record(options.choices)||Object.keys(options.choices).length>100||!(options.extraSlot===null||WORKOUTS.filter(w=>w.category==='strength').flatMap(w=>w.exercises).some(ex=>ex.slot===options.extraSlot&&ex.role!=='core')))invalid();
  for(const [key,choice] of Object.entries(options.choices)) { const base=WORKOUTS.flatMap(w=>w.exercises).find(ex=>ex.slot===key),allowed=VARIANTS[key]??(base?[base]:[]);if(!record(choice)||!allowed.some(ex=>ex.id===choice.variantId)||!string(choice.setup,200)||!(choice.supportCm===null||finite(choice.supportCm,0,300))||!['Basic','Controlled extension','Longer lever'].includes(String(choice.coreLevel)))invalid(); }
  const all=[...value.sessions,...(value.active===null?[]:[value.active])];
  for(const s of all) {if(!validNewSession(s)||!record(s)||!(p.attempts as unknown[]).some(a=>record(a)&&a.id===s.attemptId&&a.week===s.week))invalid();}
  if(!value.sessions.every(s=>record(s)&&typeof s.endedAt==='number'&&(s.exercises as ExerciseLog[]).some(ex=>ex.sets.some(set=>set.done)))||value.active!==null&&(!record(value.active)||value.active.endedAt!==undefined)||!unique(all,'id'))invalid();
  if(!value.body.every(b=>record(b)&&string(b.id,100)&&date(b.date)&&finite(b.kg,20,500))||!unique(value.body,'id')||!unique(value.body,'date'))invalid();
  if(!value.recovery.every(r=>record(r)&&string(r.id,100)&&date(r.date)&&r.date<=localDate()&&['walking','cycling'].includes(String(r.activity))&&integer(r.cardio,0,300)&&integer(r.mobility,0,300)&&Number(r.cardio)+Number(r.mobility)>0&&string(r.note)&&integer(r.week,1,16)&&(p.attempts as unknown[]).some(a=>record(a)&&a.id===r.attemptId&&a.week===r.week))||!unique(value.recovery,'id'))invalid();
  // Retired check-ins are discarded on load and import, including old-client writes.
  return {...structuredClone(value),daily:[]} as unknown as Store;
}
export function savedRaw() { return localStorage.getItem(STORAGE_KEY); }
export function saveStore(store:Store) {
  // Commit the new store first. A failed write must leave old records intact.
  localStorage.setItem(STORAGE_KEY,JSON.stringify(store));
  // Cleanup may be retried on the next save; it never prevents use of saved v4 data.
  for(const key of RETIRED_STORAGE_KEYS) { try { localStorage.removeItem(key); } catch { /* Retry later. */ } }
}
export function readStore():{store:Store;error?:string;corrupt?:boolean} {
  let raw:string|null;try{raw=savedRaw();}catch{return {store:freshStore(),error:'Browser storage is unavailable. Your changes are temporary; export a backup before closing.'};}
  try{return {store:raw===null?freshStore():validateStore(JSON.parse(raw))};}catch{return {store:freshStore(),corrupt:true,error:'Saved data could not be read. Export or restore a backup in Settings before making changes.'};}
}
