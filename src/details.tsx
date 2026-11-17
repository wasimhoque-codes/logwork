import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Check, CheckCheck, Layers, Clock3, NotebookPen, Trash2, Plus } from './icons';
import { Modal } from './components';
import { sessionWorkout, doneSets, volume, number, dateLabel, fromKg, toKg, localDate, sessionLabel, completeSession, addSessionSet, removeLastSessionSet, MAX_SETS_PER_EXERCISE, workoutDateError, markSetSkipped, skippedSets, type BodyEntry, type Session, type SetLog } from './model';
import type { Unit } from './data';
import { RirInput } from './workout';
export function BodyModal({ unit, entry, onClose, onSave }: {
    unit: Unit;
    entry?: BodyEntry;
    onClose: () => void;
    onSave: (date: string, kg: number) => Promise<void>;
}) {
    const initialWeight=entry?String(Math.round(fromKg(entry.kg,unit)*100)/100):'';
    const [date,setDate]=useState(entry?.date??localDate()),[weight,setWeight]=useState(initialWeight);
    const [error,setError]=useState(''),[saving,setSaving]=useState(false);
    const pending=useRef(false);
    async function submit(event:FormEvent) {
        event.preventDefault();
        if(pending.current) return;
        const kg=entry&&weight===initialWeight?entry.kg:toKg(Number(weight),unit);
        if(!weight||!Number.isFinite(kg)||kg<20||kg>500) {
            setError(`Enter a weight between ${number(fromKg(20,unit))} and ${number(fromKg(500,unit))} ${unit}.`);
            return;
        }
        pending.current=true;
        setSaving(true);
        setError('');
        try { await onSave(date,kg); }
        catch(error) { setError(error instanceof Error&&error.message.startsWith('A weigh-in')?error.message:'Could not save this weigh-in. Try again.'); }
        finally { pending.current=false;setSaving(false); }
    }
    return <Modal variant="sheet" title={entry?'Edit weigh-in':'Log bodyweight'} onClose={onClose} dismissDisabled={saving}>
        <form onSubmit={submit}>
            <label className="field-label" htmlFor="body-date">Date</label>
            <input className="text-input" id="body-date" type="date" required min="1900-01-01" max={localDate()} value={date} disabled={saving} onChange={event=>{setDate(event.target.value);setError('');}}/>
            <label className="field-label" htmlFor="body-weight">Bodyweight ({unit})</label>
            <input className="text-input large-input" id="body-weight" type="number" inputMode="decimal" step="any" required autoFocus placeholder={unit==='kg'?'e.g. 70.5':'e.g. 155.4'} value={weight} disabled={saving} onChange={event=>{setWeight(event.target.value);setError('');}}/>
            {error&&<p role="alert" className="form-error">{error}</p>}
            {!entry&&<p className="input-hint">Logging on a date with an existing reading updates that entry.</p>}
            <button className="primary full-width" type="submit" disabled={saving}>{saving?'Saving…':'Save bodyweight'}<Check size={17}/></button>
        </form>
    </Modal>;
}
export function SessionDetail({ session, unit, onClose, onSave, onDelete, expandFromHistory }: {
    session: Session;
    unit: Unit;
    onClose: () => void;
    onSave: (s: Session) => Promise<void>;
    onDelete: () => void;
    expandFromHistory?: boolean;
}) {
    const [editing, setEditing] = useState(false), [draft, setDraft] = useState(session), [confirmDelete, setConfirmDelete] = useState(false), [error, setError] = useState('');
    const [saving,setSaving]=useState(false);
    const dateRef=useRef<HTMLInputElement>(null),pendingSave=useRef(false);
    const listRef = useRef<HTMLDivElement>(null), pendingFocus = useRef<{ exercise: number; set: number | null } | null>(null);
    const id = useId(), w = sessionWorkout(session), label = sessionLabel(session);
    useEffect(() => {
        const target = pendingFocus.current;
        if (!target) return;
        pendingFocus.current = null;
        const exercise = listRef.current?.querySelector(`[data-exercise-index="${target.exercise}"]`);
        const control = exercise?.querySelector<HTMLElement>(target.set === null ? '.add-set' : `[data-set-index="${target.set}"] input:not(:disabled)`);
        control?.focus({ preventScroll: true });
        control?.scrollIntoView({ block: 'nearest' });
    }, [draft]);
    async function save() {
        if(pendingSave.current)return;
        const dateError=workoutDateError(draft,draft.date);
        if(dateError&&draft.date!==session.date){setError(dateError);dateRef.current?.focus();return;}
        if (draft.exercises.some(e => e.sets.some(s => s.done && (s.weight === null || !Number.isFinite(s.weight) || s.weight < 0 || s.weight > 2000 || !Number.isInteger(s.reps) || s.reps < 1 || s.reps > 1000)))) {
            setError('Logged sets need a valid weight and whole-number reps.');
            return;
        }
        if (!doneSets(draft)) {
            setError('Keep at least one logged set, or delete this workout.');
            return;
        }
        pendingSave.current=true;setSaving(true);setError('');
        try { await onSave(draft);setEditing(false); }
        catch { setError('Could not save this workout. Try again.'); }
        finally { pendingSave.current=false;setSaving(false); }
    }
    function patch(ei: number, si: number, patch: Partial<SetLog>) {
        setError('');
        setDraft(s => {
            const next=patch.done?markSetSkipped(s,ei,si,false):s;
            return {...next,exercises:next.exercises.map((e,i)=>i===ei?{...e,sets:e.sets.map((set,j)=>j===si?{...set,...patch}:set)}:e)};
        });
    }
    function addSet(ei: number) {
        if (draft.exercises[ei].sets.length >= MAX_SETS_PER_EXERCISE) return;
        pendingFocus.current = { exercise: ei, set: draft.exercises[ei].sets.length };
        setDraft(s => addSessionSet(s, ei));
        setError('');
    }
    function removeSet(ei: number) {
        const next = removeLastSessionSet(draft, ei);
        if (next === draft) return;
        pendingFocus.current = { exercise: ei, set: null };
        setDraft(next);
        setError('');
    }
    return <Modal variant="page" title={w.name} onClose={onClose} dismissDisabled={saving} expandFromHistory={expandFromHistory} wide>
        <div className="detail-subtitle"><span>{dateLabel(draft.date||session.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><span className="unit-badge">{label && label + ' · '}{completeSession(draft) ? 'Complete' : 'Partial'}</span></div>
        <div className="summary-pills"><span><CheckCheck size={15}/>{doneSets(draft)} sets</span><span><Layers size={15}/>{number(fromKg(volume(draft), unit), 0)} {unit} × reps volume</span><span><Clock3 size={15}/>{Math.round(((session.endedAt ?? session.startedAt) - session.startedAt) / 60000)} min elapsed</span></div>
        {!editing&&<div className="history-edit-actions">
            <button className="secondary" onClick={()=>setEditing(true)}><NotebookPen size={16}/>Edit workout</button>
            <button className="text-button" onClick={()=>{setEditing(true);requestAnimationFrame(()=>dateRef.current?.focus());}}>Edit date</button>
        </div>}
        {editing&&<label className="history-date-field">Workout date
            <input ref={dateRef} className="text-input" type="date" min="1900-01-01" max={localDate()} value={draft.date}
              disabled={saving} onChange={event=>{setDraft(value=>({...value,date:event.target.value}));setError('');}}/>
        </label>}
        <div className="session-detail-list" inert={saving} ref={listRef}>{draft.exercises.map((e, ei) => {
            const skipped=skippedSets(draft,ei);
            if (!editing && !e.sets.some(s => s.done) && !e.note&&!skipped.length) return null;
            const spec = w.exercises[ei], atLimit = e.sets.length >= MAX_SETS_PER_EXERCISE;
            const limitId = `${id}-set-limit-${ei}`;
            return <div className="detail-exercise" data-exercise-index={ei} key={e.id}>
                <h3>{e.name}<span>{e.mode === 'assistance' ? 'Assistance' : e.mode === 'bodyweight' ? 'Bodyweight' : unit}</span></h3>
                {spec.setup && <p className="input-hint">Setup: {spec.setup}</p>}
                {spec.supportCm !== null && spec.supportCm !== undefined && <p className="input-hint">Support: {spec.supportCm} cm</p>}
                {spec.role === 'core' && spec.coreLevel && <p className="input-hint">Core variation: {spec.coreLevel}</p>}
                {e.sets.map((s, si) => <div className={`detail-set ${!s.done ? 'not-logged' : ''}`} data-set-index={si} key={si}>
                    <span className="detail-set-label">Set {si + 1}{si >= spec.sets && <small>Extra</small>}</span>
                    {editing ? <>
                        <input type="number" min="0" inputMode="decimal" step="any" aria-label={`${e.name} set ${si + 1} weight`} disabled={e.mode === 'bodyweight'} value={s.weight === null ? '' : Math.round(fromKg(s.weight, unit) * 100) / 100} onChange={event => patch(ei, si, { weight: event.target.value === '' ? null : Math.max(0, Math.min(2000, toKg(Number(event.target.value), unit))) })}/>
                        <span>×</span>
                        <input type="number" min="1" step="1" aria-label={`${e.name} set ${si + 1} ${spec.timed ? 'seconds' : 'reps'}`} value={s.reps || ''} onChange={event => patch(ei, si, { reps: Math.max(0, Math.min(1000, Math.trunc(Number(event.target.value)))) })}/>
                        <label className="completion-checkbox"><input type="checkbox" aria-label={`${e.name} set ${si + 1} logged`} checked={s.done} onChange={event => patch(ei, si, { done: event.target.checked })}/></label>
                        <RirInput label={`${e.name} set ${si + 1} RIR`} value={s.rir} onChange={rir=>patch(ei,si,{rir})}/>
                        {si >= spec.sets && si === e.sets.length - 1 && !s.done && <button className="text-button detail-remove-set" aria-label={`Remove extra set ${si + 1} from ${e.name}`} onClick={() => removeSet(ei)}>Remove extra set</button>}
                    </> : <>
                        <strong>{s.done ? `${e.mode === 'bodyweight' ? 'BW' : `${number(fromKg(s.weight ?? 0, unit))} ${unit}`} × ${s.reps}${spec.timed ? ' sec' : ' reps'}${spec.perSide ? ' / side' : ''}` : skipped.includes(si)?'Skipped':'Not logged'}</strong>
                        <span>{s.done && s.rir !== null ? `${s.rir} RIR` : ''}</span>{s.done && <Check size={14}/>}
                    </>}
                </div>)}
                {editing && <>
                    <button className="secondary full-width add-set" aria-label={`Add set to ${e.name}`} disabled={atLimit} aria-describedby={atLimit ? limitId : undefined} onClick={() => addSet(ei)}><Plus size={18}/>Add set</button>
                    {atLimit && <p className="input-hint" id={limitId}>10-set limit reached for this exercise.</p>}
                </>}
                {editing?<label className="field-label">{e.name} notes
                    <textarea maxLength={2000} value={e.note} onChange={event=>setDraft(s=>({...s,exercises:s.exercises.map((log,i)=>i===ei?{...log,note:event.target.value}:log)}))}/>
                </label>:e.note&&<p className="detail-note">{e.note}</p>}
            </div>;
        })}</div>
        {editing ? <><label className="field-label" htmlFor="edit-session-note">Session notes</label><textarea id="edit-session-note" disabled={saving} maxLength={2000} value={draft.note} onChange={e => setDraft(s => ({ ...s, note: e.target.value }))}/></> : draft.note && <p className="session-detail-note"><NotebookPen size={16}/>{draft.note}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {confirmDelete ? <div className="delete-confirm"><p>Delete this workout and all of its logged sets?</p><button className="danger" onClick={onDelete}>Delete workout</button><button className="secondary" onClick={() => setConfirmDelete(false)}>Keep it</button></div> : <div className="detail-actions">
            {editing ? <><button className="primary" disabled={saving} onClick={save}>{saving?'Saving…':'Save changes'}<Check size={16}/></button><button className="secondary" disabled={saving} onClick={() => { setDraft(session); setEditing(false); setError(''); }}>Cancel</button></> : null}
            <button className="icon-button danger-text" aria-label="Delete workout" disabled={saving} onClick={() => setConfirmDelete(true)}><Trash2 size={18}/></button>
        </div>}
    </Modal>;
}
