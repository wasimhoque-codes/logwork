import { useEffect, useRef, type ReactNode } from 'react';
import { X, ChevronLeft, Dumbbell, MoveUpRight, Footprints, Activity, Flame, Heart, ArrowUpRight } from './icons';
import type { Exercise } from './data';
import { number } from './model';
export function Hawk({ size = 29 }: {
    size?: number;
}) { return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><path d="M3 9h20l-9 10h10l-8 10h10L13 43l5-14H9l5-10H7zM24 9h20l-8 10H25l-5 6 4-12z" fill="currentColor"/></svg>; }
export function MuscleIcon({ exercise }: {
    exercise: Exercise;
}) {
    const Icon = exercise.kind === 'lower' ? Footprints : exercise.kind === 'core' ? Activity : exercise.kind === 'carry' ? Flame : exercise.muscle === 'Back' ? MoveUpRight : Dumbbell;
    return <span className={`muscle-icon muscle-${exercise.muscle.toLowerCase().replace(' ', '-')}`}><Icon size={21} strokeWidth={1.6}/></span>;
}
export function Modal({ title, children, onClose, wide = false, variant = 'dialog' }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
    variant?: 'dialog' | 'sheet' | 'page';
}) {
    const ref = useRef<HTMLDivElement>(null);
    const returnFocus = useRef(document.activeElement as HTMLElement | null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        const previous = returnFocus.current;
        const getFocusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"], summary') ?? []).filter(e => !e.hasAttribute('disabled') && e.getClientRects().length > 0);
        if (!ref.current?.contains(document.activeElement)) getFocusable()[0]?.focus();
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onCloseRef.current();
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
        return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', handler); previous?.focus(); };
    }, []);
    return <div className={`modal-overlay ${variant === 'sheet' ? 'sheet-overlay' : variant === 'page'?'page-overlay':''}`} onClick={e => { if (e.target === e.currentTarget)
        onClose(); }}><div className={`modal ${wide ? 'modal-wide' : ''} ${variant === 'sheet' ? 'modal-sheet' : variant === 'page'?'modal-page':''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading">{variant==='page'?<><button className="icon-button" aria-label="Back to previous screen" onClick={onClose}><ChevronLeft size={22}/></button><h2>{title}</h2></>:<><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></>}</div>{children}</div></div>;
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
    return <div className="line-chart"><div className="chart-plot"><div className="chart-axis" aria-hidden="true">{[hi, (lo + hi) / 2, lo].map((v, i) => <span key={i}>{number(v)}</span>)}</div><svg viewBox="0 0 540 190" preserveAspectRatio="none" role="img" aria-label={`${label}: ${points.map(p => `${p.label}, ${number(p.value)} ${unit}`).join('; ')}`}><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".18"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>{[0, 1, 2].map(i => <line key={i} x1="10" y1={y(lo + (hi - lo) * i / 2)} x2="530" y2={y(lo + (hi - lo) * i / 2)} stroke="var(--line)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke"/>)}<path d={`${path} L ${x(points.length - 1)} 168 L ${x(0)} 168 Z`} fill="url(#chart-fill)"/><path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>{points.map((p, i) => <g key={i}><title>{p.label}: {number(p.value)} {unit}</title></g>)}</svg><div className="chart-markers" aria-hidden="true">{points.map((p,i)=><span className="chart-point" key={i} style={{left:`${x(i)/540*100}%`,top:y(p.value)}} title={`${p.label}: ${number(p.value)} ${unit}`}/>)}</div></div><div className={`chart-dates ${dates.length === 1 ? 'single' : ''}`} aria-hidden="true">{dates.map((p, i) => <span key={i}>{p.label}</span>)}</div></div>;

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
