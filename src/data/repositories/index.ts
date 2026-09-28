import { dexieRepositories } from './dexieRepositories';
import type { Repositories } from './types';

/** Einziger Zugriffspunkt der App auf Daten. In V2 hier die API-Implementierung einsetzen. */
export const repositories: Repositories = dexieRepositories;

export type * from './types';
