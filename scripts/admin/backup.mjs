// Verschlüsseltes Backup aller Konten und Daten (nur lokal beim Betreiber).
//
//   npm run backup                         → backups/arbeitszeit-backup-<zeit>.json.enc
//   npm run backup -- pruefen <datei>      → entschlüsseln und Inhalt zusammenfassen
//   npm run backup -- wiederherstellen <datei> --ja
//                                          → in das in .env.local/.env.admin.local eingestellte,
//                                            LEERE Projekt einspielen (z. B. Test- oder Ersatzprojekt)
//
// Passphrase: BACKUP_PASSPHRASE in .env.admin.local oder Eingabe beim Aufruf.
// Die Datei enthält Gesundheitsdaten – nur verschlüsselt ablegen, Passphrase im Passwort-Manager.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { adminClient, generatePassword, SUPABASE_URL } from './client.mjs';

const TABLES = [
  'organizations',
  'memberships',
  'account_status',
  'profiles',
  'schedule_versions',
  'work_days',
  'vacation_periods',
  'sick_periods',
  'custom_holidays',
];
const DATA_TABLES = TABLES.slice(3);
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const [command, file, ...flags] = process.argv.slice(2);
const admin = adminClient();

async function passphrase({ confirm }) {
  if (process.env.BACKUP_PASSPHRASE) return process.env.BACKUP_PASSPHRASE;
  if (!process.stdin.isTTY) throw new Error('BACKUP_PASSPHRASE fehlt (in .env.admin.local eintragen) – keine Eingabe möglich.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const first = await rl.question('Backup-Passphrase: ');
  if (confirm) {
    const second = await rl.question('Passphrase wiederholen: ');
    if (first !== second) throw new Error('Die Passphrasen stimmen nicht überein.');
  }
  rl.close();
  if (first.length < 12) throw new Error('Bitte eine Passphrase mit mindestens 12 Zeichen verwenden.');
  return first;
}

function encrypt(plain, pass) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(pass, salt, 32, SCRYPT);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return JSON.stringify({
    format: 'arbeitszeit-backup-encrypted',
    version: 1,
    kdf: { name: 'scrypt', ...SCRYPT, salt: salt.toString('base64') },
    cipher: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  });
}

function decrypt(content, pass) {
  const box = JSON.parse(content);
  if (box.format !== 'arbeitszeit-backup-encrypted') throw new Error('Keine Backup-Datei dieser App.');
  const { salt, N, r, p, maxmem } = box.kdf;
  const key = scryptSync(pass, Buffer.from(salt, 'base64'), 32, { N, r, p, maxmem });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
  try {
    return Buffer.concat([decipher.update(Buffer.from(box.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Entschlüsseln fehlgeschlagen – falsche Passphrase oder beschädigte Datei.');
  }
}

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function fetchUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email, user_metadata: u.user_metadata, created_at: u.created_at })));
    if (data.users.length < 200) return users;
  }
}

function summarize(backup) {
  console.log(`Backup vom ${new Date(backup.createdAt).toLocaleString('de-DE')} (Projekt ${backup.project})`);
  console.table({ Konten: backup.users.length, ...Object.fromEntries(TABLES.map((t) => [t, backup.tables[t].length])) });
}

async function create() {
  const pass = await passphrase({ confirm: !process.env.BACKUP_PASSPHRASE });
  const backup = {
    format: 'arbeitszeit-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    project: new URL(SUPABASE_URL).hostname,
    users: await fetchUsers(),
    tables: Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await fetchAll(t)]))),
  };
  mkdirSync('backups', { recursive: true });
  const d = new Date(backup.createdAt);
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  const name = `backups/arbeitszeit-backup-${stamp}.json.enc`;
  writeFileSync(name, encrypt(JSON.stringify(backup), pass));
  summarize(backup);
  console.log(`\nVerschlüsselt gespeichert: ${name}`);
  console.log('Tipp: Datei zusätzlich an einem zweiten Ort ablegen (z. B. USB-Stick) – sie ist ohne Passphrase unlesbar.');
}

async function load() {
  if (!file) throw new Error('Bitte die Backup-Datei angeben.');
  return JSON.parse(decrypt(readFileSync(file, 'utf8'), await passphrase({ confirm: false })));
}

async function check() {
  summarize(await load());
  console.log('\nDie Datei ist lesbar und vollständig entschlüsselt.');
}

async function restore() {
  if (!flags.includes('--ja')) {
    throw new Error(`Spielt das Backup in ${new URL(SUPABASE_URL).hostname} ein. Zum Bestätigen --ja anhängen.`);
  }
  const backup = await load();
  const existing = await admin.from('organizations').select('id', { count: 'exact', head: true });
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1 });
  if ((existing.count ?? 0) > 0 || existingUsers.users.length > 0) {
    throw new Error('Das Zielprojekt ist nicht leer. Wiederherstellung nur in ein leeres Projekt (nichts wird überschrieben).');
  }

  // Konten mit gleicher ID (Zuordnung der Daten bleibt erhalten); Passwörter sind nicht Teil des Backups.
  const passwords = [];
  for (const u of backup.users) {
    const password = generatePassword();
    const { error } = await admin.auth.admin.createUser({ id: u.id, email: u.email, password, email_confirm: true, user_metadata: u.user_metadata });
    if (error) throw new Error(`Konto ${u.email}: ${error.message}`);
    passwords.push({ Benutzername: u.email?.split('@')[0], Startpasswort: password });
  }
  const insert = async (table, rows) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from(table).insert(rows.slice(i, i + 500));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };
  await insert('organizations', backup.tables.organizations);
  await insert('memberships', backup.tables.memberships);
  // Nach der Wiederherstellung muss jede Person ein eigenes Passwort setzen.
  await insert('account_status', backup.tables.account_status.map((s) => ({ ...s, must_change_password: true })));
  for (const t of DATA_TABLES) await insert(t, backup.tables[t]);

  summarize(backup);
  console.log('\nWiederhergestellt. Neue Startpasswörter (persönlich übergeben):');
  console.table(passwords);
  console.log('Hinweis: Geräte müssen sich neu anmelden; siehe docs/Betrieb.md → Wiederherstellung.');
}

try {
  if (!command) await create();
  else if (command === 'pruefen') await check();
  else if (command === 'wiederherstellen') await restore();
  else console.log('Befehle: (ohne) | pruefen <datei> | wiederherstellen <datei> --ja');
} catch (e) {
  console.error('Fehler:', e.message ?? e);
  process.exit(1);
}
