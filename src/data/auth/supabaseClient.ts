import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Nur die Basisadresse (https://<id>.supabase.co); eine kopierte Data-API-Adresse wird bereinigt. */
function normalizeUrl(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase-Client der App (öffentlicher Schlüssel, Zugriffsregeln greifen).
 * `null`, wenn die Build-Variablen fehlen. Nur innerhalb von `src/data` verwenden.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(normalizeUrl(url), anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'arbeitszeit-auth',
        },
      })
    : null;
