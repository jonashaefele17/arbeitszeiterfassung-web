# Betriebsanleitung (für den Betreiber)

Alle Befehle im Projektordner ausführen. Die Befehle brauchen:
- `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `.env.admin.local`: `SUPABASE_SERVICE_ROLE_KEY`, optional `BACKUP_PASSPHRASE`

Beide Dateien werden nie eingecheckt.

## Nutzer verwalten

| Aufgabe | Befehl |
|---|---|
| Neue Person hinzufügen | `npm run admin -- anlegen <name>` |
| Passwort vergessen | `npm run admin -- passwort <name>` |
| Übersicht aller Konten | `npm run admin -- liste` |
| Konto und alle Daten löschen (z. B. Löschanfrage) | `npm run admin -- loeschen <name> --ja` |

### Neue Person hinzufügen

1. `npm run admin -- anlegen anna`. Der Befehl gibt Benutzername und Startpasswort aus.
2. Beides **persönlich** übergeben, nicht per Messenger oder Mail.
3. Die Person:
   - öffnet die App (iPhone: Safari → Teilen → „Zum Home-Bildschirm“; Android: Chrome → „App installieren“)
   - meldet sich **in der installierten App** an
   - setzt ein eigenes Passwort
   - willigt in die Speicherung ein
   - durchläuft das Onboarding

   Hat sie die App schon ohne Konto (V1.1) genutzt, werden ihre Daten beim ersten Login übernommen.

**Benutzernamen:** 3–32 Zeichen, Kleinbuchstaben, Ziffern sowie `.`, `_` und `-`. Groß- und Kleinschreibung spielt beim Login keine Rolle.

### Passwort zurücksetzen

`npm run admin -- passwort anna` erzeugt ein neues Startpasswort. Beim nächsten Login muss die Person wieder ein eigenes setzen. Ihre Daten bleiben erhalten.

## Backups

Der Supabase Free Plan macht **keine** automatischen Backups. Deshalb:

```bash
npm run backup
```

- **Inhalt:** alle Konten (ohne Passwörter) und alle Daten.
- **Verschlüsselung:** AES-256-GCM mit einer Passphrase (mindestens 12 Zeichen).
- **Ablage:** `backups/` (von Git ausgeschlossen).
- **Passphrase:** im Passwort-Manager speichern. Ohne sie ist das Backup unbrauchbar. Optional kann sie als `BACKUP_PASSPHRASE` in `.env.admin.local` stehen.
- **Rhythmus:** etwa monatlich und **immer vor einer Datenbank-Migration** (`npm run db:push`).
- **Zweiter Ort:** Backup-Dateien zusätzlich z. B. auf einem USB-Stick ablegen. **Nie unverschlüsselt** in Clouds oder Repos, denn sie enthalten Gesundheitsdaten.

Prüfen, ob ein Backup lesbar ist:

```bash
npm run backup -- pruefen backups/arbeitszeit-backup-<datum>.json.enc
```

### Wiederherstellung (einmal testweise durchspielen)

Die Wiederherstellung spielt ein Backup in ein **leeres** Supabase-Projekt ein. Ein Projekt mit Daten wird abgelehnt, es wird nie etwas überschrieben.

**Testlauf (empfohlen, einmalig):**

1. **Zweites Projekt anlegen:** in Supabase ein Gratis-Projekt, z. B. `arbeitszeit-test`, Region Frankfurt. Der Free Plan erlaubt 2 aktive Projekte.
2. **Schema einspielen:**
   - `npx supabase link --project-ref <test-projekt-id>`
   - `npm run db:push`
   - `npx supabase link --project-ref <haupt-projekt-id>`, um wieder zum Hauptprojekt zurückzuwechseln
3. **Zugangsdaten tauschen:** In `.env.local` und `.env.admin.local` vorübergehend URL, öffentlichen und Secret-Schlüssel des **Testprojekts** eintragen.
4. **Einspielen:** `npm run backup -- wiederherstellen backups/<datei>.json.enc --ja`
5. **Prüfen:** Die Ausgabe listet neue Startpasswörter. Mit einem davon in einer lokalen Entwicklungsversion anmelden (`npm run dev`, sie nutzt `.env.local`) und prüfen, ob die Daten da sind.
6. **Zurückstellen:** die ursprünglichen Werte in `.env.local` und `.env.admin.local` wieder eintragen.

**Im Ernstfall** (Hauptprojekt verloren):
- Ein neues Projekt anlegen, wie oben einspielen und die neuen Werte als GitHub-Variablen setzen.
- Jede Person bekommt ein neues Startpasswort.
- Die Geräte sollten sich einmal abmelden oder die App neu installieren, damit der Abgleich mit dem neuen Projekt von vorn beginnt.

## Schutz gegen das Pausieren

Gratis-Projekte pausieren nach etwa 1 Woche ohne Aktivität. Der GitHub-Workflow `Supabase keep-alive` (`.github/workflows/keep-alive.yml`) ruft täglich die datenfreie Funktion `keep_alive()` auf.

- **Kontrolle:** GitHub → Actions → „Supabase keep-alive“, die Läufe sollten grün sein. Manuell starten geht über „Run workflow“.
- **Achtung:** GitHub deaktiviert zeitgesteuerte Workflows in Repos, die 60 Tage keine Commits hatten. GitHub schickt dann eine Mail. Einfach wieder aktivieren.
- **Doch pausiert:** Im Supabase-Dashboard „Restore project“ wählen. Es gehen keine Daten verloren, die App arbeitet in der Zwischenzeit lokal weiter.

## Datenbank ändern

1. **Backup ziehen** (`npm run backup`).
2. **Neue Migration** unter `supabase/migrations/` anlegen.
3. **Einspielen** mit `npm run db:push`.
4. **Zugriffsregeln prüfen** mit `npm run test:rls`. Erwartet: „Alle Prüfungen bestanden.“

## Build-Variablen (GitHub → Settings → Secrets and variables → Actions → Variables)

| Variable | Pflicht | Inhalt |
|---|---|---|
| `VITE_SUPABASE_URL` | ja | `https://<projekt-id>.supabase.co`, ohne `/rest/v1/` |
| `VITE_SUPABASE_ANON_KEY` | ja | öffentlicher Schlüssel (anon/publishable) |
| `VITE_OPERATOR_NAME` | empfohlen | dein Name für die Datenschutzhinweise |
| `VITE_OPERATOR_CONTACT` | empfohlen | Kontakt für Datenschutzanfragen |

Der **Secret-Schlüssel** gehört nie in GitHub, in die App oder in Chats.
