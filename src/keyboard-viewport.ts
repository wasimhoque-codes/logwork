import { useEffect } from 'react';
import { reducedMotion } from './motion';

const setInputs = '.set-inputs input[type="number"], .modal-page .detail-set input[type="number"], .programme-sheet input[type="number"]';
const fieldGap = 8;
const viewportSettleMs = 90;

export function useKeyboardViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement.style;
    const isZoomed = () => viewport && Math.abs(viewport.scale - 1) >= 0.01;
    const getBounds = () => {
      const hasViewport = viewport && !isZoomed();
      const height = hasViewport ? viewport.height : window.innerHeight;
      const top = hasViewport ? Math.max(0, viewport.offsetTop) : 0;
      return { height, top, bottom: top + height, covered: Math.max(0, window.innerHeight - height) };
    };
    let bounds = getBounds();
    let frame = 0;
    let settleTimer = 0;
    let dockInFlow: HTMLElement | undefined;

    const focusedInput = () => {
      const field = document.activeElement;
      return field instanceof HTMLInputElement && !field.disabled && field.matches(setInputs) ? field : null;
    };

    const restoreDock = () => {
      dockInFlow?.removeAttribute('data-keyboard-in-flow');
      dockInFlow = undefined;
    };

    const reveal = () => {
      const field = focusedInput();
      if (!field || isZoomed()) return;

      const rect = field.getBoundingClientRect();
      const sheet = field.closest<HTMLElement>('.programme-sheet');
      const panel = sheet?.querySelector<HTMLElement>('.programme-sheet-body') ?? field.closest<HTMLElement>('.modal-page');
      let { top, bottom } = bounds;

      if (panel) {
        const panelRect = panel.getBoundingClientRect();
        const header = (sheet ?? panel).querySelector<HTMLElement>('.modal-heading');
        // Reserve the header's sticky height even if it has already scrolled off its starting position.
        const stickyBottom = sheet ? panelRect.top : panelRect.top + (header?.offsetHeight ?? 0);
        top = Math.max(top, stickyBottom, header?.getBoundingClientRect().bottom ?? 0);
        const footer = sheet?.querySelector<HTMLElement>('.programme-sheet-footer');
        bottom = Math.min(bottom, panelRect.bottom, footer?.getBoundingClientRect().top ?? Infinity);
      } else {
        const dock = field.closest('.workout-shell')?.querySelector<HTMLElement>('.workout-dock');
        if (dock) {
          restoreDock();
          const dockTop = dock.getBoundingClientRect().top;
          if (dockTop - top < rect.height + fieldGap * 2) {
            dock.setAttribute('data-keyboard-in-flow', '');
            dockInFlow = dock;
          } else {
            bottom = Math.min(bottom, dockTop);
          }
        }
      }

      if (rect.top >= top && rect.bottom <= bottom) return;
      const gap = bottom - top >= rect.height + fieldGap * 2 ? fieldGap : 0;
      const delta = rect.top < top + gap ? rect.top - top - gap : Math.max(0, rect.bottom - bottom + gap);
      if (Math.abs(delta) < 1) return;
      (panel ?? window).scrollBy({ top: delta, behavior: reducedMotion() ? 'instant' : 'smooth' });
    };

    const cancelPending = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };

    const checkOnFocus = () => {
      cancelPending();
      if (focusedInput()) frame = window.requestAnimationFrame(reveal);
    };

    const updateBounds = () => {
      const previous = bounds;
      bounds = getBounds();
      const viewportBottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
      root.setProperty('--keyboard-offset', Math.max(0, window.innerHeight - viewportBottom) + 'px');
      root.setProperty('--keyboard-viewport-top', bounds.top + 'px');
      root.setProperty('--keyboard-height', bounds.covered + 'px');
      if (bounds.height > previous.height && bounds.covered < 1) {
        restoreDock();
        cancelPending();
      }
      if (!focusedInput()) return;

      // Mobile browsers can resize and pan in several steps during keyboard entry.
      const shrank = previous.height - bounds.height >= 1;
      const panned = bounds.covered >= 1 && Math.abs(bounds.top - previous.top) >= 1;
      if (!shrank && !panned) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(reveal, viewportSettleMs);
    };

    updateBounds();
    document.addEventListener('focusin', checkOnFocus);
    document.addEventListener('focusout', cancelPending);
    window.addEventListener('resize', updateBounds);
    viewport?.addEventListener('resize', updateBounds);
    viewport?.addEventListener('scroll', updateBounds);
    return () => {
      cancelPending();
      restoreDock();
      document.removeEventListener('focusin', checkOnFocus);
      document.removeEventListener('focusout', cancelPending);
      window.removeEventListener('resize', updateBounds);
      viewport?.removeEventListener('resize', updateBounds);
      viewport?.removeEventListener('scroll', updateBounds);
      root.removeProperty('--keyboard-offset');
      root.removeProperty('--keyboard-viewport-top');
      root.removeProperty('--keyboard-height');
    };
  }, []);
}
