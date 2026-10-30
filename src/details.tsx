import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Check, CheckCheck, Layers, Clock3, NotebookPen, Trash2, Plus } from './icons';
import { Modal } from './components';
import { sessionWorkout, doneSets, volume, number, dateLabel, fromKg, toKg, localDate, sessionLabel, completeSession, addSessionSet, removeLastSessionSet, MAX_SETS_PER_EXERCISE, type Session, type SetLog } from './model';
import { FeedbackFields } from './programme-ui';
import type { Unit } from './data';
export function BodyModal({ unit, onClose, onSave }: {
    unit: Unit;
    onClose: () => void;
    onSave: (date: string, kg: number) => void;
}) {
    const [date, setDate] = useState(localDate()), [weight, setWeight] = useState(''), [error, setError] = useState('');
    function submit(e: FormEvent) { e.preventDefault(); const kg = toKg(Number(weight), unit); if (!weight || !Number.isFinite(kg) || kg < 20 || kg > 500) {
        setError(`Enter a weight between ${number(fromKg(20, unit))} and ${number(fromKg(500, unit))} ${unit}.`);
        return;
    } onSave(date, kg); }
    return <Modal variant="sheet" title="Log bodyweight" onClose={onClose}><form onSubmit={submit}><label className="field-label" htmlFor="body-date">Date</label><input className="text-input" id="body-date" type="date" required min="1900-01-01" max={localDate()} value={date} onChange={e => setDate(e.target.value)}/><label className="field-label" htmlFor="body-weight">Bodyweight ({unit})</label><input className="text-input large-input" id="body-weight" type="number" inputMode="decimal" step="any" required autoFocus placeholder={unit === 'kg' ? 'e.g. 70.5' : 'e.g. 155.4'} value={weight} onChange={e => { setWeight(e.target.value); setError(''); }}/>{error && <p role="alert" className="form-error">{error}</p>}<p className="input-hint">If you’ve already logged this date, this updates that entry.</p><button className="primary full-width" type="submit">Save bodyweight<Check size={17}/></button></form></Modal>;
}
export function SessionDetail({ session, unit, onClose, onSave, onDelete, onFollowup }: {
    session: Session;
    unit: Unit;
    onClose: () => void;
    onSave: (s: Session) => void;
    onDelete: () => void;
    onFollowup: () => void;
}) {
    const [editing, setEditing] = useState(false), [draft, setDraft] = useState(session), [confirmDelete, setConfirmDelete] = useState(false), [error, setError] = useState('');
    const listRef = useRef<HTMLDivElement>(null), pendingFocus = useRef<{ exercise: number; set: number | null } | null>(null);
    const id = useId(), w = sessionWorkout(session);
    useEffect(() => {
        const target = pendingFocus.current;
        if (!target) return;
        pendingFocus.current = null;
        const exercise = listRef.current?.querySelector(`[data-exercise-index="${target.exercise}"]`);
        const control = exercise?.querySelector<HTMLElement>(target.set === null ? '.add-set' : `[data-set-index="${target.set}"] input:not(:disabled)`);
        control?.focus({ preventScroll: true });
        control?.scrollIntoView({ block: 'nearest' });
    }, [draft]);
    function save() {
        if (draft.exercises.some(e => e.sets.some(s => s.done && (s.weight === null || !Number.isFinite(s.weight) || s.weight < 0 || s.weight > 2000 || !Number.isInteger(s.reps) || s.reps < 1 || s.reps > 1000)))) {
            setError('Logged sets need a valid weight and whole-number reps.');
            return;
        }
        if (!doneSets(draft)) {
            setError('Keep at least one logged set, or delete this workout.');
            return;
        }
        onSave(draft); setEditing(false); setError('');
    }
    function patch(ei: number, si: number, patch: Partial<SetLog>) {
        setError('');
        setDraft(s => ({ ...s, exercises: s.exercises.map((e, i) => i === ei ? { ...e, sets: e.sets.map((set, j) => j === si ? { ...set, ...patch } : set) } : e) }));
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
    return <Modal variant="page" title={w.name} onClose={onClose} wide>
        <div className="detail-subtitle"><span>{dateLabel(session.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><span className="unit-badge">{sessionLabel(session)} · {completeSession(draft) ? 'Complete' : 'Partial'}</span></div>
        <div className="summary-pills"><span><CheckCheck size={15}/>{doneSets(draft)} sets</span><span><Layers size={15}/>{number(fromKg(volume(draft), unit), 0)} {unit} × reps volume</span><span><Clock3 size={15}/>{Math.round(((session.endedAt ?? session.startedAt) - session.startedAt) / 60000)} min</span></div>
        <div className="session-detail-list" ref={listRef}>{draft.exercises.map((e, ei) => {
            if (!editing && !e.sets.some(s => s.done) && !e.note) return null;
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
                        {si >= spec.sets && si === e.sets.length - 1 && !s.done && <button className="text-button detail-remove-set" aria-label={`Remove extra set ${si + 1} from ${e.name}`} onClick={() => removeSet(ei)}>Remove extra set</button>}
                    </> : <>
                        <strong>{s.done ? `${e.mode === 'bodyweight' ? 'BW' : `${number(fromKg(s.weight ?? 0, unit))} ${unit}`} × ${s.reps}${spec.timed ? ' sec' : ' reps'}${spec.perSide ? ' / side' : ''}` : 'Not logged'}</strong>
                        <span>{s.done && s.rir !== null ? `${s.rir} RIR` : ''}</span>{s.done && <Check size={14}/>}
                    </>}
                </div>)}
                {editing && <>
                    <button className="secondary full-width add-set" aria-label={`Add set to ${e.name}`} disabled={atLimit} aria-describedby={atLimit ? limitId : undefined} onClick={() => addSet(ei)}><Plus size={18}/>Add set</button>
                    {atLimit && <p className="input-hint" id={limitId}>10-set limit reached for this exercise.</p>}
                </>}
                {e.note && <p className="detail-note">{e.note}</p>}
            </div>;
        })}</div>
        {editing ? <><label className="field-label" htmlFor="edit-session-note">Session notes</label><textarea id="edit-session-note" maxLength={2000} value={draft.note} onChange={e => setDraft(s => ({ ...s, note: e.target.value }))}/></> : draft.note && <p className="session-detail-note"><NotebookPen size={16}/>{draft.note}</p>}
        {draft.feedback && (editing ? <FeedbackFields includeBefore feedback={draft.feedback} onChange={feedback => setDraft(s => ({ ...s, feedback }))}/> : <p className="input-hint">Technique: {draft.feedback.technique === null ? 'unrecorded' : draft.feedback.technique ? 'controlled' : 'needs improvement'} · After: {draft.feedback.after ?? 'unrecorded'} · Next day: {draft.feedback.nextDay ?? 'unrecorded'}</p>)}
        {session.programId === 'programme-16' && session.date < localDate() && !editing && <button className="summary-link" onClick={onFollowup}>Review next-day recovery</button>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {confirmDelete ? <div className="delete-confirm"><p>Delete this workout and all of its logged sets?</p><button className="danger" onClick={onDelete}>Delete workout</button><button className="secondary" onClick={() => setConfirmDelete(false)}>Keep it</button></div> : <div className="detail-actions">
            {editing ? <><button className="primary" onClick={save}>Save changes<Check size={16}/></button><button className="secondary" onClick={() => { setDraft(session); setEditing(false); setError(''); }}>Cancel</button></> : <button className="secondary" onClick={() => setEditing(true)}><NotebookPen size={16}/>Edit workout</button>}
            <button className="icon-button danger-text" aria-label="Delete workout" onClick={() => setConfirmDelete(true)}><Trash2 size={18}/></button>
        </div>}
    </Modal>;
}
