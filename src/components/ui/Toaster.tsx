import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '../../stores/toastStore';
import { transitions } from './motion';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-4"
      style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 12px) + 72px)' }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={transitions.standard}
            className={`rounded-full px-5 py-2.5 text-[15px] font-medium shadow-lg ${
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'
            }`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
