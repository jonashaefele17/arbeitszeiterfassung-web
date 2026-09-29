// Nutzerverwaltung für den Betreiber. Aufruf: npm run admin -- <befehl> [argumente]
import {
  adminClient,
  emailToUsername,
  ensureOrganization,
  findUserByUsername,
  generatePassword,
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from './client.mjs';

const HELP = `
Nutzerverwaltung (nur lokal, nutzt den Service-Schlüssel)

  npm run admin -- anlegen <name> [--admin]   Konto + Mitgliedschaft anlegen, Startpasswort ausgeben
  npm run admin -- passwort <name>            neues Startpasswort (muss beim Login ersetzt werden)
  npm run admin -- liste                      alle Konten anzeigen
  npm run admin -- loeschen <name> --ja       Konto und ALLE Daten endgültig löschen
`;

const [command, rawName, ...flags] = process.argv.slice(2);
const admin = adminClient();

function requireName() {
  const name = normalizeUsername(rawName ?? '');
  if (!isValidUsername(name)) {
    console.error('Ungültiger Benutzername. Erlaubt: 3–32 Zeichen, Kleinbuchstaben, Ziffern, . _ -');
    process.exit(1);
  }
  return name;
}

async function requireUser(name) {
  const user = await findUserByUsername(admin, name);
  if (!user) {
    console.error(`Kein Konto „${name}“ gefunden.`);
    process.exit(1);
  }
  return user;
}

function printCredentials(name, password) {
  console.log(`\n  Benutzername:  ${name}\n  Startpasswort: ${password}\n`);
  console.log('Persönlich übergeben. Beim ersten Login muss ein eigenes Passwort gesetzt werden.');
}

async function create() {
  const name = requireName();
  if (await findUserByUsername(admin, name)) {
    console.error(`Konto „${name}“ existiert bereits.`);
    process.exit(1);
  }
  const org = await ensureOrganization(admin);
  const password = generatePassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(name),
    password,
    email_confirm: true,
    user_metadata: { username: name },
  });
  if (error) throw error;
  const userId = data.user.id;
  try {
    const role = flags.includes('--admin') ? 'admin' : 'employee';
    const m = await admin.from('memberships').insert({ user_id: userId, organization_id: org.id, role });
    if (m.error) throw m.error;
    const s = await admin.from('account_status').insert({ user_id: userId, must_change_password: true });
    if (s.error) throw s.error;
  } catch (e) {
    await admin.auth.admin.deleteUser(userId); // nichts Halbfertiges zurücklassen
    throw e;
  }
  console.log(`Konto „${name}“ angelegt (Organisation „${org.name}“).`);
  printCredentials(name, password);
}

async function resetPassword() {
  const name = requireName();
  const user = await requireUser(name);
  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
  const s = await admin
    .from('account_status')
    .upsert({ user_id: user.id, must_change_password: true, updated_at: new Date().toISOString() });
  if (s.error) throw s.error;
  console.log(`Passwort für „${name}“ zurückgesetzt.`);
  printCredentials(name, password);
}

async function list() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const [members, status] = await Promise.all([
    admin.from('memberships').select('user_id, role'),
    admin.from('account_status').select('user_id, must_change_password'),
  ]);
  if (members.error) throw members.error;
  if (status.error) throw status.error;
  const role = new Map(members.data.map((m) => [m.user_id, m.role]));
  const pending = new Map(status.data.map((s) => [s.user_id, s.must_change_password]));
  if (data.users.length === 0) return console.log('Keine Konten.');
  console.table(
    data.users.map((u) => ({
      Benutzername: emailToUsername(u.email ?? ''),
      Rolle: role.get(u.id) ?? '– (ohne Freigabe)',
      'Startpasswort aktiv': pending.get(u.id) ? 'ja' : 'nein',
      'Letzter Login': u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('de-DE') : '–',
    })),
  );
}

async function remove() {
  const name = requireName();
  if (!flags.includes('--ja')) {
    console.error(`Löscht „${name}“ und ALLE zugehörigen Daten endgültig. Zum Bestätigen --ja anhängen.`);
    process.exit(1);
  }
  const user = await requireUser(name);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  console.log(`Konto „${name}“ und alle Daten gelöscht.`);
}

const commands = { anlegen: create, passwort: resetPassword, liste: list, loeschen: remove };

try {
  const run = commands[command];
  if (!run) console.log(HELP);
  else await run();
} catch (e) {
  console.error('Fehler:', e.message ?? e);
  process.exit(1);
}
