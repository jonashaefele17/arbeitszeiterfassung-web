import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { transitions } from './motion';

/** Stapel geöffneter Sheets – Escape schließt nur das oberste. */
const openSheets: symbol[] = [];

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Zugänglicher Titel des Dialogs. */
  label: string;
  children: ReactNode;
  /** Wird nach dem Schließen (Ende der Animation) aufgerufen. */
  onExitComplete?: () => void;
  zIndex?: number;
}

/**
 * Bottom Sheet mit Slide-In, Wischen zum Schließen und Escape-Taste.
 * Der Inhalt kann sich fließend verändern, ohne dass ein neues Modal erscheint.
 */
export function BottomSheet({ open, onClose, label, children, onExitComplete, zIndex = 40 }: BottomSheetProps) {
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const token = Symbol('sheet');
    openSheets.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === token) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 50);
    return () => {
      openSheets.splice(openSheets.indexOf(token), 1);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <div className="fixed inset-0" style={{ zIndex }}>
          <motion.div
            className="absolute inset-0 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.standard}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-surface shadow-[0_-8px_40px_rgba(0,0,0,0.08)] outline-none"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={transitions.sheet}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-3"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1.5 w-10 rounded-full bg-line" />
            </div>
            <div className="no-scrollbar safe-bottom overflow-y-auto overscroll-contain px-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
