import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { X, ChevronLeft, Dumbbell, MoveUpRight, Footprints, Activity, Flame, Heart, ArrowUpRight } from './icons';
import type { Exercise } from './data';
import { number } from './model';
import { motionDuration, motionPreference, reducedMotion } from './motion';
export function Hawk({ size = 29 }: {
    size?: number;
}) { return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><path d="M3 9h20l-9 10h10l-8 10h10L13 43l5-14H9l5-10H7zM24 9h20l-8 10H25l-5 6 4-12z" fill="currentColor"/></svg>; }
export function MuscleIcon({ exercise }: {
    exercise: Exercise;
}) {
    const Icon = exercise.kind === 'lower' ? Footprints : exercise.kind === 'core' ? Activity : exercise.kind === 'carry' ? Flame : exercise.muscle === 'Back' ? MoveUpRight : Dumbbell;
    return <span className={`muscle-icon muscle-${exercise.muscle.toLowerCase().replace(' ', '-')}`}><Icon size={21} strokeWidth={1.6}/></span>;
}
export const ModalTriggerContext = createContext<RefObject<HTMLElement | null> | null>(null);

function historyRowInset(overlay: HTMLElement, row: HTMLElement | null) {
    if (!row?.isConnected || !row.matches('.history-row')) return null;
    const frame = overlay.getBoundingClientRect(), bounds = row.getBoundingClientRect();
    const left = Math.max(frame.left, bounds.left), right = Math.min(frame.right, bounds.right);
    const top = Math.max(frame.top, bounds.top), bottom = Math.min(frame.bottom, bounds.bottom);
    if (right <= left || bottom <= top) return null;
    return `inset(${top - frame.top}px ${frame.right - right}px ${frame.bottom - bottom}px ${left - frame.left}px round 14px)`;
}

export function Modal({ title, children, onClose, wide = false, variant = 'dialog', expandFromHistory = false }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
    variant?: 'dialog' | 'sheet' | 'page';
    expandFromHistory?: boolean;
}) {
    const historySurfaceRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const ref = useRef<HTMLDivElement>(null);
    const trigger = useContext(ModalTriggerContext)?.current;
    const returnFocus = useRef(trigger?.isConnected ? trigger : document.activeElement as HTMLElement | null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const [closing, setClosing] = useState(false);
    const closingRef = useRef(false), closedRef = useRef(false);
    const finishDismiss = useCallback(() => {
        if (closedRef.current) return;
        closedRef.current = true;
        onCloseRef.current();
    }, []);
    const dismiss = useCallback(() => {
        if (closingRef.current || closedRef.current) return;
        const backdrop = backdropRef.current, panel = ref.current;
        if (!backdrop || !panel || reducedMotion() || !motionDuration('--motion-dismiss')) { finishDismiss(); return; }
        // A quick dismissal starts from the current entrance frame.
        const panelStyle = getComputedStyle(panel);
        backdrop.style.setProperty('--dismiss-opacity', getComputedStyle(backdrop).opacity);
        panel.style.setProperty('--dismiss-opacity', panelStyle.opacity);
        panel.style.setProperty('--dismiss-transform', panelStyle.transform);
        const surface = historySurfaceRef.current;
        if (surface?.hasAttribute('data-history-origin')) {
            const inset = historyRowInset(surface, returnFocus.current);
            if (inset) {
                surface.style.setProperty('--history-origin', inset);
                const { clipPath, opacity } = getComputedStyle(surface);
                surface.style.setProperty('--history-current', clipPath === 'none' ? 'inset(0 round 0px)' : clipPath);
                surface.style.setProperty('--history-opacity', opacity);
            } else surface.removeAttribute('data-history-origin');
        }
        closingRef.current = true;
        setClosing(true);
    }, [finishDismiss]);
    useEffect(() => {
        if (!closing) return;
        const timer = window.setTimeout(finishDismiss, motionDuration('--motion-dismiss') + 40);
        return () => window.clearTimeout(timer);
    }, [closing, finishDismiss]);
    useLayoutEffect(() => {
        const previous = returnFocus.current;
        const getFocusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"], summary') ?? []).filter(e => !e.hasAttribute('disabled') && e.getClientRects().length > 0);
        if (!ref.current?.contains(document.activeElement)) getFocusable()[0]?.focus({ preventScroll: true });
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                dismiss();
            if (e.key === 'Tab') {
                const elements = getFocusable(), first = elements[0], last = elements.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        const oldOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handler);
        const preference = motionPreference();
        const onPreference = () => { if (preference.matches && closingRef.current) finishDismiss(); };
        preference.addEventListener('change', onPreference);
        return () => { preference.removeEventListener('change', onPreference); document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', handler); if (previous?.isConnected) previous.focus({preventScroll:true}); };
    }, [dismiss, finishDismiss]);
    useLayoutEffect(() => {
        const surface = historySurfaceRef.current;
        if (!surface || reducedMotion() || !CSS.supports('clip-path', 'inset(0 round 0px)')) return;
        const inset = historyRowInset(surface, returnFocus.current);
        if (!inset) return;
        surface.style.setProperty('--history-origin', inset);
        surface.setAttribute('data-history-origin', '');
        const preference = motionPreference();
        const settle = () => { if (preference.matches) surface.removeAttribute('data-history-origin'); };
        preference.addEventListener('change', settle);
        return () => { preference.removeEventListener('change', settle); surface.removeAttribute('data-history-origin'); };
    }, [expandFromHistory]);
    const content = <>
        <div ref={backdropRef} className="modal-backdrop" aria-hidden="true" onAnimationEnd={e=>{if(closing&&e.animationName==='overlay-out')finishDismiss();}}/>
        <div className={`modal ${wide ? 'modal-wide' : ''} ${variant === 'sheet' ? 'modal-sheet' : variant === 'page'?'modal-page':''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading">{variant==='page'?<><button className="icon-button" aria-label="Back to previous screen" onClick={dismiss}><ChevronLeft size={22}/></button><h2>{title}</h2></>:<><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={dismiss}><X size={20}/></button></>}</div>{children}</div>
    </>;
    return <div className={`modal-overlay ${variant === 'sheet' ? 'sheet-overlay' : variant === 'page'?'page-overlay':''}`} data-state={closing?'closing':'open'}
        onClickCapture={e=>{if(closingRef.current){e.preventDefault();e.stopPropagation();}}}
        onSubmitCapture={e=>{if(closingRef.current){e.preventDefault();e.stopPropagation();}}}
        onClick={e=>{if(e.target===e.currentTarget||e.target===historySurfaceRef.current)dismiss();}}>
        {expandFromHistory ? <div className="history-modal-surface" ref={historySurfaceRef}>{content}</div> : content}
    </div>;
}
export function Empty({ title, text, icon = 'activity', action }: {
    title: string;
    text: string;
    icon?: 'activity' | 'heart';
    action?: ReactNode;
}) { const Icon = icon === 'heart' ? Heart : Activity; return <div className="empty-state"><span className="empty-icon"><Icon size={26} strokeWidth={1.3}/></span><h3>{title}</h3><p>{text}</p>{action}</div>; }
export function LineChart({ points, unit, label }: {
    points: {
        label: string;
        value: number;
    }[];
    unit: string;
    label: string;
}) {
    if (!points.length)
        return <Empty title="No data yet." text="Start logging to see your progress."/>;
    const min = Math.min(...points.map(p => p.value)), max = Math.max(...points.map(p => p.value));
    const padding = Math.max((max - min) * .3, max * .04, 1);
    const lo = Math.max(0, min - padding), hi = max + padding;
    const x = (i: number) => points.length === 1 ? 270 : 10 + i / (points.length - 1) * 520;
    const y = (v: number) => 168 - (v - lo) / (hi - lo) * 150;
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
    const dates = points.length === 1 ? [points[0]] : points.length === 2 ? points : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
    return <div className="line-chart"><div className="chart-plot"><div className="chart-axis" aria-hidden="true">{[hi, (lo + hi) / 2, lo].map((v, i) => <span key={i}>{number(v)}</span>)}</div><svg viewBox="0 0 540 190" preserveAspectRatio="none" role="img" aria-label={`${label}: ${points.map(p => `${p.label}, ${number(p.value)} ${unit}`).join('; ')}`}><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-fill)" stopOpacity=".18"/><stop offset="100%" stopColor="var(--chart-fill)" stopOpacity="0"/></linearGradient></defs>{[0, 1, 2].map(i => <line key={i} x1="10" y1={y(lo + (hi - lo) * i / 2)} x2="530" y2={y(lo + (hi - lo) * i / 2)} stroke="var(--line)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke"/>)}<path d={`${path} L ${x(points.length - 1)} 168 L ${x(0)} 168 Z`} fill="url(#chart-fill)"/><path d={path} fill="none" stroke="var(--chart-line)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>{points.map((p, i) => <g key={i}><title>{p.label}: {number(p.value)} {unit}</title></g>)}</svg><div className="chart-markers" aria-hidden="true">{points.map((p,i)=><span className="chart-point" key={i} style={{left:`${x(i)/540*100}%`,top:y(p.value)}} title={`${p.label}: ${number(p.value)} ${unit}`}/>)}</div></div><div className={`chart-dates ${dates.length === 1 ? 'single' : ''}`} aria-hidden="true">{dates.map((p, i) => <span key={i}>{p.label}</span>)}</div></div>;

}
export function SectionHeading({ title, eyebrow, action }: {
    title: string;
    eyebrow?: string;
    action?: ReactNode;
}) { return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>; }
export function TextLink({ children, onClick }: {
    children: ReactNode;
    onClick: () => void;
}) { return <button className="text-link" onClick={onClick}>{children}<ArrowUpRight size={15}/></button>; }
