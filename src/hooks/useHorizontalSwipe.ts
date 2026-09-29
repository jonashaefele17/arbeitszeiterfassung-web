import type { PanInfo } from 'framer-motion';
import { useRef, type MouseEvent } from 'react';

const SWIPE_THRESHOLD = 60;

/**
 * Motion-Props für horizontales Wischen zwischen Zeiträumen (Woche/Monat).
 * Nach links wischen → nächster Zeitraum, nach rechts → vorheriger.
 * Nach einer Wischbewegung wird kein Tippen auf ein enthaltenes Element ausgelöst.
 * Das Element braucht zusätzlich die Klasse `touch-pan-y`, damit vertikales Scrollen möglich bleibt.
 */
export function useHorizontalSwipe(onSwipe: (direction: 1 | -1) => void) {
  const dragged = useRef(false);

  return {
    drag: 'x' as const,
    dragDirectionLock: true,
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.15,
    onPointerDownCapture: () => {
      dragged.current = false;
    },
    onDragStart: () => {
      dragged.current = true;
    },
    onDragEnd: (_: unknown, info: PanInfo) => {
      if (Math.abs(info.offset.x) < SWIPE_THRESHOLD || Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
      onSwipe(info.offset.x < 0 ? 1 : -1);
    },
    onClickCapture: (e: MouseEvent) => {
      if (!dragged.current) return;
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    },
  };
}
