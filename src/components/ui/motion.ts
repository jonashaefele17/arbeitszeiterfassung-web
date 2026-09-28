import type { Transition } from 'framer-motion';

/** Zentrale Animationswerte. Animation erklärt räumliche Beziehungen – sie erzwingt keine Aufmerksamkeit. */
export const transitions = {
  micro: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
  standard: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
  sheet: { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } satisfies Transition,
  layout: { type: 'spring', stiffness: 420, damping: 40 } satisfies Transition,
};

export const pressable = {
  whileTap: { scale: 0.97 },
  transition: transitions.micro,
};
