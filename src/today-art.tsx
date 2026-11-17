import { useCallback } from 'react';
import { motionPreference } from './motion';

export type TodayArtKind = 'strength' | 'recovery' | 'bodyweight' | 'progress';

type Slot = {
  element: HTMLSpanElement;
  kind: TodayArtKind;
  visible: boolean;
  animation?: { target: CanvasRenderingContext2D; started: number };
};

type Drawing = typeof import('./today-art-scene');
type Register = (element: HTMLSpanElement, kind: TodayArtKind) => () => void;

const duration = 2000;
const frameInterval = 1000 / 30 - .5;

export function createTodayArtPlayback(): Register {
  const slots = new Map<Element, Slot>();
  const played = new Set<TodayArtKind>();
  let observer: IntersectionObserver | undefined;
  let preference: MediaQueryList;
  let drawing: Drawing | undefined;
  let renderer: ReturnType<Drawing['createTodayArtRenderer']>;
  let loading = false;
  let failed = false;
  let frame = 0;
  let lastDraw = -Infinity;

  function stop(slot: Slot) {
    slot.animation = undefined;
    slot.element.removeAttribute('data-animating');
  }

  function stopAll() {
    cancelAnimationFrame(frame);
    frame = 0;
    for (const slot of slots.values()) stop(slot);
  }

  function fallback() {
    failed = true;
    stopAll();
    renderer?.dispose();
    renderer = null;
  }

  function pending(slot: Slot) {
    return slot.visible && (slot.animation !== undefined || !played.has(slot.kind));
  }

  function schedule() {
    if (!observer || failed || frame || preference.matches || document.hidden) return;
    if (![...slots.values()].some(pending)) return;
    frame = requestAnimationFrame(tick);
  }

  function drawFrame(slot: Slot, now: number, activeRenderer: NonNullable<typeof renderer>) {
    if (!slot.animation) {
      played.add(slot.kind);
      const canvas = slot.element.querySelector('canvas');
      const width = Math.round(slot.element.clientWidth * Math.min(devicePixelRatio, 1.5) / 4) * 4;
      if (!canvas || !width) return;
      canvas.width = width;
      canvas.height = width * .75;
      const target = canvas.getContext('2d');
      if (!target) return;
      activeRenderer.draw(slot.kind, target, 0);
      slot.animation = { target, started: performance.now() };
      slot.element.setAttribute('data-animating', '');
      return;
    }
    const { started, target } = slot.animation;
    const progress = (now - started) / duration;
    if (progress >= 1) stop(slot);
    else activeRenderer.draw(slot.kind, target, Math.max(0, progress));
  }

  function tick(now: number) {
    frame = 0;
    if (preference.matches || document.hidden) return;
    if (!drawing) {
      if (!loading) {
        loading = true;
        void import('./today-art-scene').then(module => {
          drawing = module;
          schedule();
        }).catch(fallback);
      }
      return;
    }
    try {
      renderer ??= drawing.createTodayArtRenderer(fallback);
      if (!renderer) {
        fallback();
        return;
      }
      if (now - lastDraw >= frameInterval) {
        lastDraw = now;
        // Give each new scene its own frame for shader compilation.
        let initializing = false;
        for (const slot of slots.values()) {
          if (!pending(slot) || (!slot.animation && initializing)) continue;
          if (!slot.animation) initializing = true;
          drawFrame(slot, now, renderer);
        }
      }
      schedule();
    } catch {
      fallback();
    }
  }

  function refreshVisibility() {
    if (preference.matches || document.hidden) stopAll();
    else schedule();
  }

  return (element, kind) => {
    if (!('IntersectionObserver' in window)) return () => {};
    if (!observer) {
      preference = motionPreference();
      preference.addEventListener('change', refreshVisibility);
      document.addEventListener('visibilitychange', refreshVisibility);
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const slot = slots.get(entry.target);
          if (!slot) continue;
          slot.visible = entry.intersectionRatio >= .25;
          if (!slot.visible) stop(slot);
        }
        schedule();
      }, { threshold: .25 });
    }

    const slot: Slot = { element, kind, visible: false };
    slots.set(element, slot);
    observer.observe(element);
    return () => {
      stop(slot);
      slots.delete(element);
      observer?.unobserve(element);
      if (slots.size) return;
      observer?.disconnect();
      observer = undefined;
      preference.removeEventListener('change', refreshVisibility);
      document.removeEventListener('visibilitychange', refreshVisibility);
      stopAll();
      renderer?.dispose();
      renderer = null;
      played.clear();
    };
  };
}

export function TodayIllustration({ kind, register }: { kind: TodayArtKind; register: Register }) {
  const attach = useCallback((element: HTMLSpanElement | null) => {
    if (element) return register(element, kind);
  }, [kind, register]);
  return <span ref={attach} className="today-illustration" data-art={kind} aria-hidden="true">
    {/* The local PNG is the rest pose and is included in the offline shell. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/today-art/${kind}.png`} alt="" width="480" height="360" draggable={false}/>
    <canvas width="4" height="3"/>
  </span>;
}
