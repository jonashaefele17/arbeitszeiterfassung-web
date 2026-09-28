import { motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { transitions } from './motion';

/** Animiert Höhenänderungen des Inhalts – das Sheet wächst/schrumpft fließend. */
export function AnimatedHeight({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div animate={{ height }} transition={transitions.standard} className="overflow-hidden">
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
