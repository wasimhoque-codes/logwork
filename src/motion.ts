import { useEffect, useRef, type RefObject } from 'react';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function motionDuration(token: string) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token)) || 0;
}

// Animate existing nodes: changing a route or exercise must not remount inputs.
// Direct children keep fixed docks and overlays outside the animated surfaces.
export function useContentFade(ref: RefObject<HTMLElement | null>, destination: string | number, children = false) {
  useEffect(() => {
    const root = ref.current;
    if (!root || reducedMotion()) return;
    const targets = children
      ? Array.from(root.children).filter((element): element is HTMLElement => element instanceof HTMLElement && !element.matches('.workout-dock, .flow-actions, .modal-overlay, .progress-switch'))
      : [root];
    const animations = targets.map(element => element.animate([{ opacity: .65 }, { opacity: 1 }], {
      duration: motionDuration('--motion-content'), easing: 'cubic-bezier(.2,.7,.2,1)',
    }));
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cancel = () => animations.forEach(animation => animation.cancel());
    preference.addEventListener('change', cancel);
    return () => { cancel(); preference.removeEventListener('change', cancel); };
  }, [ref, destination, children]);
}

export function useSetFeedback(ref: RefObject<HTMLElement | null>, logged: number, exercise: number) {
  const previous = useRef({logged,exercise});
  useEffect(() => {
    const increased = exercise === previous.current.exercise && logged > previous.current.logged;
    previous.current = {logged,exercise};
    if (!increased || !ref.current || reducedMotion()) return;
    const animation = ref.current.animate([
      { borderColor: 'var(--accent)', backgroundColor: 'var(--selection)' },
      { borderColor: getComputedStyle(ref.current).borderColor, backgroundColor: getComputedStyle(ref.current).backgroundColor },
    ], { duration: motionDuration('--motion-content'), easing: 'ease-out' });
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cancel = () => animation.cancel();
    preference.addEventListener('change', cancel);
    return () => { cancel(); preference.removeEventListener('change', cancel); };
  }, [ref, logged, exercise]);
}
