import { createContext, useContext } from 'react';
import type { CalculationContext } from '../domain/calculations/context';
import type { UserProfile } from '../domain/models';

export interface ReadyData {
  profile: UserProfile;
  ctx: CalculationContext;
}

export const AppDataContext = createContext<ReadyData | null>(null);

/** Profil und Berechnungskontext innerhalb der eingerichteten App. */
export function useReadyData(): ReadyData {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useReadyData außerhalb von AppDataContext');
  return value;
}
