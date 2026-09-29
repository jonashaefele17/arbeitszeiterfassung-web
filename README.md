# Arbeitszeit – PWA zur Arbeitszeiterfassung (V2)

Mobile-first Progressive Web App zur Erfassung der eigenen Arbeitszeiten. Die App arbeitet **local-first**: Alle Daten liegen auf dem Gerät (IndexedDB) und die App funktioniert offline. Mit einem Konto werden die Daten über Supabase (Rechenzentrum Frankfurt) zwischen Geräten synchronisiert und gesichert.

- **Konten:** Benutzername + Passwort. Konten legt nur der Betreiber an (`npm run admin`).
- **Sync:** Outbox und Versionsprüfung. Bei Konflikten entscheidet der Nutzer, nichts wird still überschrieben.
- **Datenschutz:** Einwilligung für Krankheitstage, Datenschutzhinweise, Export, Konto löschen.

Konzept und Etappen: [docs/V2-Konzept.md](docs/V2-Konzept.md) · Betrieb (Nutzer, Backups, Keep-alive): [docs/Betrieb.md](docs/Betrieb.md)

## Befehle

```bash
npm install
npm run dev        # Entwicklungsserver (nutzt .env.local)
npm test           # Unit-Tests (Domain-Logik, Sync-Engine)
npm run build      # Typecheck + Produktionsbuild inkl. Service Worker
npm run preview    # Build lokal ausliefern (PWA/Offline testen)

npm run admin -- <befehl>   # Nutzerverwaltung (siehe docs/Betrieb.md)
npm run backup              # verschlüsseltes Backup
npm run db:push             # Datenbank-Migrationen einspielen
npm run test:rls            # Zugriffsregeln gegen das Supabase-Projekt prüfen
```

**Konfiguration:**
- `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_OPERATOR_NAME` und `VITE_OPERATOR_CONTACT`
- `.env.admin.local`, nur für die Admin-Skripte: `SUPABASE_SERVICE_ROLE_KEY`, optional `BACKUP_PASSPHRASE`

Beide Dateien werden nie eingecheckt.

App-Icons neu erzeugen: `node scripts/generate-icons.mjs`

## Architektur

```
UI (features/, components/)
  → Domain (domain/: Berechnung, Feiertage, Konfliktprüfung – ohne React/IndexedDB)
  → Repositories (data/repositories – fachliche Interfaces; schreiben lokal + Outbox)
  → Dexie / IndexedDB (lokale Datenquelle, offline)
        ⇅ Sync (data/sync: Push/Pull, Konflikte) ⇅ Supabase (Postgres + Row Level Security)
```

- Die UI kennt weder Dexie noch Supabase. Daten laufen über `data/repositories`, die Anmeldung über `data/auth`, der Sync über `data/sync`.
- Monats- und Kontowerte werden nie gespeichert, sondern immer aus den Rohdaten berechnet (`domain/calculations`).
- Server-Schema und Zugriffsregeln liegen in `supabase/migrations/`.
- Zustand (`stores/`) enthält nur UI-Zustand.

## Fachliche Regeln (abweichend vom bzw. ergänzend zum Master-Prompt abgestimmt)

- **Bezahlte Tage (ab V1.1):** Feiertage, Urlaub und Krankheit zählen an regulären Arbeitstagen mit Soll = Ist = reguläre Sollzeit, an Nicht-Arbeitstagen mit 0. Arbeit an einem Feiertag ersetzt den Feiertag und läuft gegen die reguläre Sollzeit.
- **Urlaubskonto:** pro Kalenderjahr: Anspruch + Resturlaub aus dem Vorjahr − genommen. Resturlaub wird unbegrenzt übertragen (kein negativer Übertrag). Im Jahr des Kontostarts gelten der beim Onboarding angegebene Resturlaub und die bereits genommenen Tage; dazu kommt der in der App eingetragene Urlaub ab dem Kontostart.
- **Überstunden frei:** Wird über den Urlaub-Dialog eingetragen (Urlaubszeitraum mit `kind: 'overtime'`). Diese Tage haben Soll = reguläre Sollzeit, Ist = 0 und verbrauchen keinen Urlaub. Sie wirken auf den Saldo also wie ein nicht eingetragener Tag, auch zeitlich: abgezogen wird erst ab dem Tag selbst, nicht beim Eintragen im Voraus.
- **Nicht eingetragen:** Vergangene reguläre Arbeitstage ab Kontostart ohne Eintrag werden pastellgelb als Warnung markiert und zählen weiterhin als Minusstunden.
- **Priorität:** Expliziter Arbeitstag > Feiertag (gesetzlich/manuell) > Krank > Urlaub > leer. Ein Feiertag im Urlaub kostet keinen Urlaubstag. Eine Krankheit im Urlaub gibt den Urlaubstag zurück.
- **Soll:** Leere reguläre Arbeitstage zählen nur zwischen Kontostart und heute als Minus. Das Konto beginnt mit einem Startsaldo aus dem Onboarding.
- **Standardwoche** ist versioniert (gültig ab). Änderungen wirken nicht rückwirkend.
- **Feiertage Bayern:** nur landesweit einheitliche, ohne Mariä Himmelfahrt und ohne Augsburger Friedensfest. Diese lassen sich als manuelle Feiertage setzen.
- Keine Rundung, alle Werte in ganzen Minuten.
