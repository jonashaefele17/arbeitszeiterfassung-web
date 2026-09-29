// Gemeinsame Helfer für die Admin-Skripte. Läuft nur lokal beim Betreiber.
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { usernameToEmail } from '../../src/data/auth/username.ts';

export { isValidUsername, normalizeUsername, usernameToEmail, emailToUsername } from '../../src/data/auth/username.ts';

function requireEnv(name, hint) {
  const value = process.env[name];
  if (!value) {
    console.error(`Fehlt: ${name} – ${hint}`);
    process.exit(1);
  }
  return value;
}

// Nur die Basisadresse (https://<id>.supabase.co); eine kopierte Data-API-Adresse (/rest/v1/) wird bereinigt.
export const SUPABASE_URL = requireEnv('VITE_SUPABASE_URL', 'in .env.local eintragen')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
export const ANON_KEY = requireEnv('VITE_SUPABASE_ANON_KEY', 'in .env.local eintragen');

/** Client mit Service-Schlüssel: umgeht RLS. Nur für Verwaltungsaufgaben. */
export function adminClient() {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'in .env.admin.local eintragen (siehe docs/V2-Etappe-1.md)');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Client wie in der App (öffentlicher Schlüssel, RLS aktiv). */
export function appClient() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

const LETTERS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/**
 * Gut lesbares Startpasswort ohne verwechselbare Zeichen (0/O, 1/l/I).
 * Enthält immer mindestens einen Buchstaben und eine Ziffer
 * (Passwort-Anforderungen in Supabase: min. 8 Zeichen, „Letters and digits“).
 */
export function generatePassword(length = 12) {
  const pick = (set) => set[randomInt(set.length)];
  const all = LETTERS + DIGITS;
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates, damit die garantierten Zeichen nicht immer vorne stehen
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Die (einzige) Organisation; wird beim ersten Aufruf angelegt. */
export async function ensureOrganization(admin, name = 'Team') {
  const { data, error } = await admin.from('organizations').select('id, name').order('created_at');
  if (error) throw error;
  if (data.length > 1) throw new Error('Mehr als eine Organisation vorhanden – bitte im Dashboard prüfen.');
  if (data.length === 1) return data[0];
  const created = await admin.from('organizations').insert({ name }).select('id, name').single();
  if (created.error) throw created.error;
  return created.data;
}

export async function findUserByUsername(admin, username) {
  const email = usernameToEmail(username);
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}
