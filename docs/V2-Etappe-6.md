# V2 – Etappe 6: Datenschutz-Funktionen

Ziel: Bevor Gesundheitsdaten (Krankheitstage) anderer Personen auf dem Server gespeichert werden, sind Einwilligung, Datenschutzhinweise und die Betroffenenrechte in der App umgesetzt.

> Die Texte sind eine sorgfältige, aber **keine rechtlich geprüfte** Fassung. Vor der Nutzung durch weitere Personen sollten sie idealerweise geprüft werden.

## Was die App jetzt kann

| Funktion | Wo | Details |
|---|---|---|
| **Einwilligung** | nach dem Login bzw. nach dem ersten Passwortwechsel, vor allen Daten | Kurzfassung in 4 Punkten, Link auf die vollständigen Hinweise, Einwilligungs-Haken (ausdrücklich, Art. 9 DSGVO). Gespeichert wird der Zeitpunkt am Konto (`account_status.health_data_consent_at`). Einmal pro Konto; bestehende Konten werden beim nächsten Start gefragt. |
| **Datenschutzhinweise** | Einwilligung und Einstellungen → Datenschutz | Verantwortlicher, welche Daten, Zweck, Rechtsgrundlage, Speicherort (Frankfurt), Zugriff (du, Betreiber technisch, kein Arbeitgeber), Speicherdauer, Rechte |
| **Daten exportieren** | Einstellungen → Datenschutz | JSON-Datei mit Profil, Standardwoche, Arbeitstagen, Urlaub/Überstunden frei, Krankheit, Feiertagen. Wird geteilt (mobil) oder heruntergeladen. |
| **Konto und Daten löschen** | Einstellungen → Datenschutz | Bestätigung durch Eintippen des Benutzernamens. Löscht das Konto am Server (alle Daten per Kaskade) und die Daten auf dem Gerät. Braucht Internet. |
| **Widerruf** | Datenschutzhinweise | durch Löschen des Kontos oder Nachricht an den Betreiber |

## Betreiber-Angaben (bitte setzen)

Die Datenschutzhinweise nennen den Verantwortlichen. Dazu zwei **optionale Build-Variablen** setzen:

- **GitHub:** Settings → Secrets and variables → Actions → Variables
- **Lokal:** in `.env.local`

| Variable | Beispiel |
|---|---|
| `VITE_OPERATOR_NAME` | Jonas Mustermann |
| `VITE_OPERATOR_CONTACT` | eine E-Mail-Adresse oder Telefonnummer |

Ohne diese Variablen steht dort neutral: „die Person, die diese App betreibt und dir deinen Zugang gegeben hat“.

## Server

Migration `supabase/migrations/20261001120000_privacy.sql`:

- `account_status.health_data_consent_at`: Die Einwilligung liegt am Konto. Die ungenutzte Spalte in `profiles` wurde entfernt.
- `give_health_data_consent()`: setzt den Zeitpunkt für das eigene Konto.
- `delete_own_account()`: löscht das eigene Konto, alle Daten hängen per `ON DELETE CASCADE` daran.

Beide Funktionen sind nur für angemeldete Nutzer erlaubt. Die RLS-Tests prüfen: Einwilligung nur für das eigene Konto, Löschen nur des eigenen Kontos (andere unberührt), ohne Anmeldung nicht möglich.

## Tests

- **RLS-Test:** 24/24 Prüfungen, davon 4 neu (`npm run test:rls`).
- **Browser-Test gegen das echte Projekt:**
  - Einwilligung erscheint, ist ohne Haken gesperrt, und die Hinweise lassen sich öffnen
  - keine erneute Abfrage nach dem Neuladen
  - Export enthält alle Daten
  - Löschen ist gesperrt, bis der Benutzername eingegeben ist
  - das Konto ist danach weg, eine Anmeldung ist nicht mehr möglich
- Alle bisherigen Browser-Tests (Login, Sync, V1.1-Übernahme, Konflikte) laufen mit dem neuen Schritt weiterhin fehlerfrei.
