import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { transitions } from './motion';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Ausdrückliche Bestätigung vor Aktionen, die Daten ersetzen oder löschen. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onCancelRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const t = window.setTimeout(() => cancelRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(t);
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.standard}
            onClick={onCancel}
            aria-hidden
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="safe-bottom relative w-full max-w-sm rounded-[28px] bg-surface p-6 shadow-xl"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={transitions.standard}
          >
            <h2 className="text-[20px] font-semibold leading-snug">{title}</h2>
            {children && <div className="mt-3 text-[15px] leading-relaxed text-ink-2">{children}</div>}
            <div className="mt-6 flex flex-col gap-2">
              <Button
                block
                onClick={onConfirm}
                className={destructive ? '!bg-danger' : ''}
              >
                {confirmLabel}
              </Button>
              <Button ref={cancelRef} block variant="secondary" onClick={onCancel}>
                {cancelLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
