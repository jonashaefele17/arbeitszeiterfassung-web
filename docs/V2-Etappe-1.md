# V2 – Etappe 1: Schema, Zugriffsregeln und Admin-Skript

Ziel: Das Datenbankschema liegt in Supabase, die Zugriffsregeln sind nachweislich dicht, und Konten lassen sich per Skript verwalten. Die App selbst ändert sich in dieser Etappe noch nicht.

## Was im Repo vorbereitet ist

| Datei | Inhalt |
|---|---|
| `supabase/migrations/20260930120000_initial_schema.sql` | Tabellen, Sync-Spalten (`version`, `revision`, `deleted`), Trigger, Zugriffsregeln (RLS), Freigaben |
| `supabase/config.toml` | Supabase-CLI-Konfiguration |
| `src/data/auth/username.ts` | Benutzername ↔ interne Anmeldeadresse (`anna` → `anna@arbeitszeit.local`), gemeinsam für App und Skripte |
| `scripts/admin/admin.mjs` | Nutzerverwaltung: anlegen, Passwort zurücksetzen, auflisten, löschen |
| `scripts/admin/rls-test.mjs` | Prüft die Zugriffsregeln mit temporären Testkonten |

## Deine Schritte

Einmalig, ca. 10 Minuten. Alle Befehle im Projektordner ausführen.

### 1. Service-Schlüssel lokal hinterlegen

In Supabase unter **Project Settings → API Keys** den **Secret-Schlüssel** kopieren (beginnt mit `sb_secret_…`, in der älteren Ansicht „service_role“). Im Projektordner eine Datei `.env.admin.local` anlegen, mit einer Zeile:

```text
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

**Warum eine eigene Datei:**
- Nur die Admin-Skripte lesen sie, die App nie.
- Sie ist wie `.env.local` per `.gitignore` ausgeschlossen.
- Dieser Schlüssel umgeht alle Zugriffsregeln. Er gehört nirgendwo anders hin.

### 2. Supabase-CLI mit deinem Projekt verbinden

```bash
npx supabase login
```

Öffnet den Browser zur Anmeldung. Danach:

```bash
npx supabase link --project-ref <projekt-id>
```

- Die Projekt-ID ist der Teil vor `.supabase.co` in deiner Project URL.
- Beim Verknüpfen wird das **Datenbank-Passwort** abgefragt, das aus deinem Passwort-Manager.

### 3. Schema einspielen

```bash
npm run db:push
```

Die CLI zeigt die Migration an und fragt nach Bestätigung. Danach sind im Dashboard unter **Table Editor** die neuen Tabellen sichtbar.

*Warum per Migration statt per Klick im Dashboard:* Jede Änderung am Schema liegt versioniert im Repo, ist nachvollziehbar und lässt sich in ein Test-Projekt erneut einspielen, z. B. beim Test der Wiederherstellung.

### 4. Zugriffsregeln prüfen

```bash
npm run test:rls
```

Das Skript legt kurzzeitig drei Testkonten an: A, B und eines ohne Freigabe. Es prüft unter anderem:

- **Trennung:** A und B sehen und ändern gegenseitig nichts.
- **Ohne Freigabe oder Anmeldung:** kein Zugriff.
- **Löschen:** Echtes Löschen ist gesperrt, nur der Löschmarker geht.
- **Versionen:** Versionen und Revisionen vergibt der Server.
- **Selbstbedienung:** Man kann sich nicht selbst zum Admin machen.

Danach entfernt es die Testkonten wieder. Erwartete letzte Zeile: **„Alle Prüfungen bestanden.“**

Die erste Prüfung zeigt auch, dass Supabase die Kunstadressen (`…@arbeitszeit.local`) akzeptiert.

### 5. Optional: Admin-Skript ausprobieren

```bash
npm run admin -- anlegen test-jonas
npm run admin -- liste
npm run admin -- passwort test-jonas
npm run admin -- loeschen test-jonas --ja
```

Die eigentlichen Konten legst du erst an, wenn der Login in der App fertig ist (Etappe 2).

## Befehlsübersicht

| Befehl | Wirkung |
|---|---|
| `npm run admin -- anlegen <name> [--admin]` | Konto und Mitgliedschaft anlegen, Startpasswort ausgeben |
| `npm run admin -- passwort <name>` | neues Startpasswort, das beim nächsten Login ersetzt werden muss |
| `npm run admin -- liste` | alle Konten mit Rolle, Startpasswort-Status und letztem Login |
| `npm run admin -- loeschen <name> --ja` | Konto und **alle** Daten endgültig löschen |
| `npm run db:push` | neue Migrationen einspielen (vorher Backup ziehen, sobald echte Daten existieren) |
| `npm run test:rls` | Zugriffsregeln prüfen |

**Benutzernamen:** 3–32 Zeichen, Kleinbuchstaben, Ziffern sowie `.`, `_` und `-`.
