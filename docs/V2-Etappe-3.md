# V2 – Etappe 3: Synchronisierung (inkl. erstem Abgleich)

Ziel: Die Daten eines Kontos sind zwischen Geräten synchron und am Server gesichert. Die App bleibt dabei voll offline-fähig.

**Status:** umgesetzt und getestet, **noch nicht live**. Live geht Etappe 3 zusammen mit Etappe 4 (Konflikt-Dialog).

## Wie es funktioniert

| Baustein | Datei | Aufgabe |
|---|---|---|
| Outbox | `src/data/sync/outbox.ts` | Jede lokale Änderung merkt den Datensatz in derselben Transaktion zum Hochladen vor (pro Datensatz zusammengefasst) |
| Tabellen-Zuordnung | `src/data/sync/tables.ts` | lokal ↔ Server (camelCase ↔ snake_case); Profil-ID am Server = Konto-ID |
| Server-Zugriff | `src/data/sync/remote.ts` | Anlegen, Ändern nur bei passender Version, Änderungen seit Revision abholen |
| Sync-Logik | `src/data/sync/syncEngine.ts` | Push, Pull, Konflikte festhalten, erster Abgleich, Aufräumen |
| Steuerung | `src/data/sync/syncService.ts` | wann synchronisiert wird; Status für die Anzeige |
| Oberfläche | `src/features/sync/` | Sync-Symbol in der Kopfzeile, erster Abgleich (`SyncGate`) |

**Wann wird synchronisiert?**
- ca. 0,4 s nach jeder Änderung
- beim Start
- bei Rückkehr in die App
- bei wiederhergestellter Verbindung
- alle 2 Minuten bei geöffneter App
- per Antippen des Sync-Symbols

**Konflikte:**
- Ein Eintrag wurde auf zwei Geräten geändert, bevor eines synchronisiert hat: Er wird festgehalten und **nicht überschrieben**. Das Symbol zeigt „!“.
- Die Auflösung per Dialog folgt in Etappe 4.
- Bis dahin bleibt die Version dieses Geräts sichtbar.

**Erster Abgleich nach dem Login:**

| Gerät | Konto | Ergebnis |
|---|---|---|
| Daten (z. B. V1.1) | leer | Gerätedaten werden hochgeladen |
| leer | Daten | Kontodaten werden geladen |
| leer | leer | Onboarding |
| Daten | Daten | Rückfrage: „Kontodaten verwenden“ (Gerätedaten verwerfen) oder Abmelden |

**Abmelden:**
- **Alles gesichert:** Die lokalen Daten werden entfernt.
- **Ausstehende Änderungen oder Konflikte:** Die App warnt mit „Nicht alle Änderungen sind gesichert“. Du kannst erneut synchronisieren oder trotzdem abmelden.

## Bekannte Grenze

Revisionen vergibt eine Datenbank-Sequenz. Schreiben zwei Geräte **exakt gleichzeitig**, kann eine Transaktion mit kleinerer Revision nach einer größeren sichtbar werden, und ein Pull könnte sie überspringen. Bei einer Person mit gelegentlich zwei Geräten ist das praktisch ausgeschlossen. Falls nötig, lässt es sich später mit einem kleinen Überlappungsfenster beim Pull absichern.

## Tests

- **Unit-Tests** (`src/data/sync/syncEngine.test.ts`, mit nachgebautem Server und `fake-indexeddb`):
  - Outbox
  - Hochladen, Ändern und Löschen
  - Offline-Verhalten
  - Abholen, auch Löschungen und nur neue Änderungen
  - kein Überschreiben ausstehender Änderungen
  - Konflikte: gleicher Datensatz, gleicher Arbeitstag auf zwei Geräten
  - alle Fälle des ersten Abgleichs
  - verlustfreie Umwandlung
- **Browser-Tests gegen das echte Projekt:**
  - zwei Geräte mit demselben Konto (Sync in beide Richtungen, offline nachholen, Löschen, Konflikt, Abmelden mit und ohne ausstehende Änderungen, erneuter Login)
  - ein Handy mit echten V1.1-Daten: wird ins leere Konto übernommen, bei vorhandenen Kontodaten erscheint die Rückfrage
