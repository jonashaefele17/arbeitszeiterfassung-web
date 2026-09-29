// Prüft die Zugriffsregeln (RLS) gegen das echte Supabase-Projekt.
// Legt temporäre Testkonten an und entfernt sie am Ende wieder (samt Daten).
// Aufruf: npm run test:rls
import { randomUUID } from 'node:crypto';
import { adminClient, appClient, ensureOrganization, generatePassword, usernameToEmail } from './client.mjs';

const admin = adminClient();
const suffix = randomUUID().slice(0, 8);
const created = [];
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` – ${detail}` : ''}`);
  if (!ok) failures++;
}

async function createTestUser(label, { member }) {
  const username = `rls-test-${label}-${suffix}`;
  const password = generatePassword(20);
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Konto anlegen (${username}): ${error.message}`);
  created.push(data.user.id);
  if (member) {
    const org = await ensureOrganization(admin);
    const m = await admin.from('memberships').insert({ user_id: data.user.id, organization_id: org.id });
    if (m.error) throw m.error;
    await admin.from('account_status').insert({ user_id: data.user.id, must_change_password: true });
  }
  const client = appClient();
  const signIn = await client.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (signIn.error) throw new Error(`Login (${username}): ${signIn.error.message}`);
  return { id: data.user.id, client };
}

const workDay = (date) => ({
  id: randomUUID(),
  date,
  start_time: '08:00',
  end_time: '14:00',
  break_minutes: 30,
  planned_minutes: 330,
});

try {
  console.log('Legt Testkonten an …\n');
  const a = await createTestUser('a', { member: true });
  const b = await createTestUser('b', { member: true });
  const c = await createTestUser('ohne-freigabe', { member: false });
  check('Benutzername als Kunstadresse (…@arbeitszeit.local) wird akzeptiert, Login funktioniert', true);

  // --- A legt Daten an -------------------------------------------------------
  const dayA = workDay('2026-09-28');
  const insA = await a.client.from('work_days').insert(dayA).select().single();
  check('A kann eigenen Arbeitstag anlegen', !insA.error, insA.error?.message);
  check('Server setzt user_id, organization_id, version = 1', insA.data?.user_id === a.id && !!insA.data?.organization_id && insA.data?.version === 1);
  const rev1 = insA.data?.revision ?? 0;

  // --- Isolation --------------------------------------------------------------
  const readB = await b.client.from('work_days').select('*').eq('id', dayA.id);
  check('B sieht den Arbeitstag von A nicht', !readB.error && readB.data.length === 0);

  const updB = await b.client.from('work_days').update({ end_time: '20:00' }).eq('id', dayA.id).select();
  check('B kann den Arbeitstag von A nicht ändern', !updB.error && updB.data.length === 0);

  const forged = await b.client.from('work_days').insert({ ...workDay('2026-09-29'), user_id: a.id });
  check('B kann keine Daten im Namen von A anlegen', !!forged.error);

  const delA = await a.client.from('work_days').delete().eq('id', dayA.id).select();
  const stillThere = await admin.from('work_days').select('id').eq('id', dayA.id);
  check('Echtes Löschen ist für Nutzer nicht möglich (nur Löschmarker)', stillThere.data?.length === 1, delA.error?.message);

  // --- Versionen & Revisionen -------------------------------------------------
  const upd = await a.client.from('work_days').update({ end_time: '15:00', version: 99, user_id: b.id }).eq('id', dayA.id).select().single();
  check('Update erhöht version auf 2 (Client-Wert wird ignoriert)', upd.data?.version === 2, upd.error?.message);
  check('Update erhöht revision', (upd.data?.revision ?? 0) > rev1);
  check('Besitzer lässt sich nicht umschreiben', upd.data?.user_id === a.id);

  const dup = await a.client.from('work_days').insert(workDay('2026-09-28'));
  check('Zweiter Arbeitstag am selben Datum wird abgelehnt', dup.error?.code === '23505', dup.error?.message);

  const softDel = await a.client.from('work_days').update({ deleted: true }).eq('id', dayA.id).select().single();
  check('Löschmarker setzen funktioniert', softDel.data?.deleted === true, softDel.error?.message);
  const again = await a.client.from('work_days').insert(workDay('2026-09-28'));
  check('Nach Löschmarker darf das Datum neu erfasst werden', !again.error, again.error?.message);

  // --- Konto ohne Freigabe ----------------------------------------------------
  const readC = await c.client.from('work_days').select('*');
  check('Konto ohne Freigabe sieht keine Daten', !readC.error && readC.data.length === 0);
  const insC = await c.client.from('work_days').insert(workDay('2026-09-30'));
  check('Konto ohne Freigabe kann nichts anlegen', !!insC.error);

  // --- Verwaltungstabellen ----------------------------------------------------
  const ownStatus = await a.client.from('account_status').select('*');
  check('A sieht nur den eigenen Kontostatus', ownStatus.data?.length === 1 && ownStatus.data[0].user_id === a.id);
  const escalate = await a.client.from('memberships').update({ role: 'admin' }).eq('user_id', a.id).select();
  check('A kann sich nicht selbst zum Admin machen', !!escalate.error || escalate.data.length === 0);
  const selfStatus = await a.client.from('account_status').update({ must_change_password: false }).eq('user_id', a.id).select();
  check('Kontostatus nicht direkt änderbar', !!selfStatus.error || selfStatus.data.length === 0);
  const rpc = await a.client.rpc('complete_password_change');
  const afterRpc = await admin.from('account_status').select('must_change_password').eq('user_id', a.id).single();
  check('complete_password_change setzt das eigene Flag zurück', !rpc.error && afterRpc.data?.must_change_password === false, rpc.error?.message);

  // --- Anonym -----------------------------------------------------------------
  const anon = await appClient().from('work_days').select('*');
  check('Ohne Anmeldung kein Zugriff', !!anon.error || anon.data.length === 0);
} catch (e) {
  console.error('\nAbbruch:', e.message ?? e);
  failures++;
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id);
  console.log(`\nTestkonten entfernt (${created.length}).`);
}

console.log(failures === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
