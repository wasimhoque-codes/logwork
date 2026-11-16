import { useLayoutEffect, useRef, type RefObject } from 'react';

export const motionPreference = () => window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => motionPreference().matches;

export function motionDuration(token: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const duration = parseFloat(value) || 0;
  return value.endsWith('ms') ? duration : duration * 1000;
}

function animateElements(elements: Element[], frames: Keyframe[], token: string) {
  const preference = motionPreference();
  if (preference.matches || !elements.length || !Element.prototype.animate) return;
  const duration = motionDuration(token);
  if (!duration) return;
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() || 'ease-out';
  const animations = elements.map(element => element.animate(frames, { duration, easing }));
  const cancel = () => animations.forEach(animation => animation.cancel());
  preference.addEventListener('change', cancel);
  return () => { cancel(); preference.removeEventListener('change', cancel); };
}

// Keep route motion on content surfaces so fixed controls retain their viewport anchor.
export function useContentFade(ref: RefObject<Element | null>, destination: string | number, mode: 'fade' | 'page' | 'panel' | 'exercise' | 'selection' = 'fade') {
  const previous = useRef(destination);
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = destination;
    const root = ref.current;
    if (!root || from === destination) return;
    if (mode === 'page' && destination === 'workout') {
      return animateElements(Array.from(root.querySelectorAll(':scope > .exercise-heading, :scope > .focused-set, :scope > .exercise-complete')), [{ opacity: .78 }, { opacity: 1 }], '--motion-content');
    }
    const targets = mode === 'page'
      ? Array.from(root.children).filter(element => !element.matches('.workout-dock, .flow-actions, .modal-overlay, .progress-switch'))
      : [root];
    const offset = mode === 'exercise' ? `${Number(destination) > Number(from) ? 6 : -6}px 0` : '0 4px';
    // The grid restores a saved scroll position and focuses its tile during entry.
    const fadeOnly = mode === 'fade' || destination === 'progress/exercises';
    const frames = mode === 'selection'
      ? [{ opacity: .7, transform: 'perspective(750px) translateY(5px) translateZ(-9px)' }, { opacity: 1, transform: 'none' }]
      : fadeOnly ? [{ opacity: .72 }, { opacity: 1 }] : [{ opacity: .78, translate: offset }, { opacity: 1, translate: 'none' }];
    return animateElements(targets, frames, '--motion-content');
  }, [ref, destination, mode]);
}

export function useTabHighlight(ref: RefObject<HTMLDivElement | null>, selection: string, visible: boolean) {
  useLayoutEffect(() => {
    const strip = ref.current;
    if (!strip || !visible) return;
    const selected = strip.querySelector<HTMLButtonElement>('[aria-selected=true]');
    if (!selected) return;
    const place = (move: boolean) => {
      const x = `${selected.offsetLeft}px`, width = `${selected.offsetWidth}px`;
      if (strip.style.getPropertyValue('--tab-x') === x && strip.style.getPropertyValue('--tab-width') === width) return;
      strip.toggleAttribute('data-highlight-moving', move && strip.hasAttribute('data-highlight-ready'));
      strip.style.setProperty('--tab-x', x);
      strip.style.setProperty('--tab-width', width);
      strip.setAttribute('data-highlight-ready', '');
    };
    place(true);
    const observer = new ResizeObserver(() => place(false));
    observer.observe(strip);
    observer.observe(selected);
    return () => observer.disconnect();
  }, [ref, selection, visible]);
}

export function useSetFeedback(ref: RefObject<HTMLElement | null>, dock: RefObject<HTMLElement | null>, logged: number, exercise: number) {
  const previous = useRef({ logged, exercise });
  useLayoutEffect(() => {
    const increased = exercise === previous.current.exercise && logged > previous.current.logged;
    previous.current = { logged, exercise };
    const panel = ref.current;
    if (!increased || !panel || reducedMotion()) return;
    const check = animateElements(Array.from(panel.querySelectorAll('.set-log-check')), [
      { opacity: 0, transform: 'perspective(120px) translateY(-4px) translateZ(9px) rotateX(-32deg)' },
      { opacity: 1, transform: 'none' },
    ], '--motion-content');
    const rest = animateElements(Array.from(dock.current?.querySelectorAll('.rest-timer') ?? []), [
      { opacity: .55, transform: 'perspective(500px) translateY(7px) rotateX(-7deg)' },
      { opacity: 1, transform: 'none' },
    ], '--motion-content');
    return () => { check?.(); rest?.(); };
  }, [ref, dock, logged, exercise]);
}
