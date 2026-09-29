# V2-Konzept: Backend, Konten und Synchronisierung

Status: **abgestimmt, noch nicht umgesetzt** · Stand: V1.1 (`84de585`)

## 1. Ziel

V1/V1.1 speichert alle Daten ausschließlich lokal im Browser (IndexedDB). V2 ergänzt:

- **Konten:** Jede Person hat ein eigenes Konto und sieht nur ihre eigenen Daten.
- **Mehrere Geräte:** Die Daten sind zwischen Handy und Laptop synchron und serverseitig gesichert.
- **Weitere Personen:** Kollegen lassen sich einfach hinzufügen.
- **Chef-Ansicht:** Sie wird nicht umgesetzt, die Architektur hält sie aber offen.

Die App bleibt dabei **voll offline-fähig**.

### Rahmenbedingungen

- Start mit einer Person. Weitere Kollegen sind wahrscheinlich, ein Arbeitgeber ist aktuell nicht beteiligt.
- Möglichst kostenlos, wenig Wartung, Hosting in der EU.
- Es werden Gesundheitsdaten gespeichert (Status „krank“, ohne Diagnose), siehe Abschnitt 8.

## 2. Entscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Architektur | **Local-first**: Dexie bleibt Datenquelle der App, der Server ist Sync-Ziel | Offline ohne Sonderfälle; UI und Domain-Logik bleiben unverändert |
| Backend | **Supabase**, Region Frankfurt (eu-central-1) | Postgres, Row Level Security, Auth mit Passwort-Login und Nutzerverwaltung per Admin-API eingebaut, Open Source (kein Lock-in), Free Tier |
| Login | **Benutzername + Passwort**, kein Mailversand | Kein Mailanbieter nötig; funktioniert in installierten iOS-PWAs (keine Links/Redirects); Passwort-Manager von iOS/Android füllen aus |
| Konten | **Nur der Betreiber legt Konten an** (Registrierung aus), Startpasswort wird beim ersten Login ersetzt | Keine Fremdnutzung, keine echten E-Mail-Adressen gespeichert, ein Schritt pro neuem Kollegen |
| Konflikte | **Versionsbasiert erkennen, Nutzer entscheidet** | Nie stilles Überschreiben (Grundsatz aus V1: keine stillen Datenverluste) |
| Organisationen | **Von Anfang an**, schlank (eine Organisation) | Chef-Rolle und firmenweite Einstellungen später ohne Datenumbau |
| Berechnungen | **Weiter nur im Client**, der Server speichert nur Rohdaten | Keine doppelte Logik; Salden werden nie gespeichert |
| Frontend-Hosting | **Bleibt GitHub Pages** | Nur Supabase-URL und öffentlicher Schlüssel kommen als Build-Variablen dazu |

**Verworfene Alternativen:**
- **Login per E-Mail-Code:** bräuchte einen eigenen Mailanbieter (SMTP) samt weiterem Auftragsverarbeitungsvertrag, weil der Supabase-Standardversand stark limitiert ist.
- **Registrierung mit Freigabe durch den Betreiber:** Jeder könnte Konten anlegen (wenn auch ohne Datenzugriff); die direkte Kontenanlage ist einfacher und dichter.
- **Firebase:** eingebauter Offline-Sync, aber starke Anbieterbindung und NoSQL. Die Rollenregeln für eine Chef-Ansicht wären aufwendiger.
- **Eigener Server:** hoher Wartungsaufwand, Auth müsste selbst gebaut werden.
- **Dexie Cloud:** passt technisch gut, ist aber nur für wenige Nutzer kostenlos und der Hosting-Standort ist unklar.

## 3. Architektur

```text
UI / Features
   ↓
Repositories (unverändertes Interface)
   ↓                         ↘
Dexie (lokal) ── Outbox ──► SyncService ◄──► Supabase (Postgres + RLS + Auth)
   ↑                              │
   └──────── Pull (Änderungen) ───┘
```

- **Repositories** schreiben wie bisher lokal. Zusätzlich legen sie in derselben Dexie-Transaktion einen Eintrag in der **Outbox** an.
- **SyncService:** schickt die Outbox an den Server (Push), holt Änderungen ab (Pull) und verwaltet Konflikte und den Sync-Status.
- **UI:** reagiert weiter über `useLiveQuery` auf die lokale Datenbank. Vom Server abgeholte Änderungen erscheinen dadurch automatisch.
- **Domain-Logik** (`src/domain`): bleibt unverändert und React-frei. Sie lässt sich später für die Chef-Ansicht wiederverwenden.

## 4. Datenmodell (Server)

Gemeinsame Sync-Spalten in allen Nutzdaten-Tabellen:

| Spalte | Zweck |
|---|---|
| `id uuid` | Vom Client erzeugt (wie heute `crypto.randomUUID()`) |
| `user_id uuid` | Besitzer (`auth.users`) |
| `organization_id uuid` | Organisation des Besitzers |
| `version bigint` | Wird bei jeder Änderung um 1 erhöht; Basis der Konflikterkennung |
| `revision bigint` | Globale, streng steigende Änderungsnummer (Sequenz), für „Änderungen seit …“ |
| `deleted boolean` | Löschmarker; Löschungen müssen andere Geräte erreichen |
| `updated_at timestamptz` | Serverzeit der letzten Änderung (nur Information) |

Tabellen:

```text
organizations      id, name
memberships        user_id, organization_id, role ('employee' | 'admin')
account_status     user_id (PK), must_change_password boolean   (nur vom Betreiber/Server gesetzt)
profiles           user_id (PK), first_name, last_name, vacation_days_per_year,
                   tracking_start_date, initial_balance_minutes,
                   initial_vacation_as_of, initial_vacation_taken_days,
                   initial_vacation_carryover_days, health_data_consent_at, + Sync-Spalten
schedule_versions  valid_from, schedule jsonb,                      + Sync-Spalten
work_days          date, start, end, break_minutes, planned_minutes, + Sync-Spalten
                   UNIQUE (user_id, date) WHERE NOT deleted
vacation_periods   start_date, end_date, kind ('overtime' | null),   + Sync-Spalten
sick_periods       start_date, end_date,                             + Sync-Spalten
custom_holidays    date,                                             + Sync-Spalten
                   (user_id NULL = später firmenweiter Feiertag der Organisation)
```

- Die Felder entsprechen 1:1 den heutigen Domain-Modellen (`src/domain/models`).
- Datumswerte bleiben ISO-Strings bzw. `date`, Zeiten `HH:mm` bzw. `time`.
- Das Schema wird als SQL-Migrationen im Repo versioniert (`supabase/migrations/`).

### Zugriffsregeln (Row Level Security)

RLS ist **auf jeder Tabelle aktiv**.

- **Nutzdaten:** lesen und schreiben nur, wenn `user_id = auth.uid()`. Echtes Löschen ist nicht erlaubt, nur der Löschmarker `deleted`.
- **`organizations`/`memberships`:** Nutzer sehen nur eigene Mitgliedschaften. Gepflegt werden sie nur vom Betreiber.
- **Später (Chef-Ansicht):** zusätzliche Leseregel „Mitglied mit Rolle `admin` derselben Organisation“.
- **Tests:** RLS wird automatisiert geprüft, z. B. „Nutzer A kann Daten von B weder lesen noch ändern“.

## 5. Synchronisierung

### Push (lokal → Server)

1. Eine Änderung wird lokal gespeichert, und in derselben Transaktion entsteht ein Outbox-Eintrag. Er enthält Tabelle, Datensatz und die **Basisversion**, also die zuletzt vom Server bekannte Version.
2. Ist das Gerät online, wird **sofort** gepusht, gebündelt. Weitere Auslöser:
   - App-Start
   - Rückkehr in den Vordergrund (`visibilitychange`)
   - `online`-Event
   - Verlassen der App (Best-Effort)
3. Der Server (Postgres-Funktion `push_changes`) prüft jeden Eintrag einzeln:
   - **Neu**, oder die Basisversion entspricht der Serverversion: übernehmen, `version + 1`, neue `revision`.
   - **Serverversion ist neuer:** Das ist ein **Konflikt**. Der Server ändert nichts und liefert seine Version zurück.
   - **Eindeutigkeit verletzt** (zwei Geräte legen offline denselben Arbeitstag an): ebenfalls ein Konflikt, mit dem bestehenden Datensatz.
4. Erfolgreiche Einträge verlassen die Outbox, und das Gerät übernimmt die neue Version.

### Pull (Server → lokal)

- **Auslöser:** App-Start, Vordergrund, alle paar Minuten bei geöffneter App. Optional kommt Supabase Realtime dazu, dann liegen Änderungen anderer Geräte nach ca. 1 s vor.
- **Abfrage:** alle Datensätze mit `revision > letzteBekannteRevision`, pro Tabelle. Danach wird die höchste Revision gespeichert.
- **Einspielen:** Datensätze ohne offene lokale Änderung werden direkt übernommen. Hat der Datensatz noch einen Outbox-Eintrag, entscheidet der nächste Push, ob es ein Konflikt ist.

### Konflikte

- Konflikte landen in einer lokalen Tabelle `conflicts`. Die App zeigt einen Hinweis mit beiden Versionen:

  ```text
  Montag, 28. September wurde auf zwei Geräten geändert
  Dieses Gerät   08:00 – 14:00 · 5,5 h
  Anderes Gerät  08:00 – 15:00 · 6,5 h
  [ Dieses Gerät behalten ]   [ Anderes übernehmen ]
  ```

- **„Dieses Gerät behalten“:** Push mit der Serverversion als neuer Basis.
- **„Anderes übernehmen“:** Die Serverversion wird lokal übernommen und der Outbox-Eintrag verworfen.
- Bis zur Entscheidung bleibt die lokale Version sichtbar und markiert.
- Das gilt auch für Löschungen, z. B. „auf dem anderen Gerät gelöscht“.

### Sync-Status und Faustregel

- In der Kopfzeile steht einer von drei Zuständen: **✓ Synchronisiert**, **⟳ Wird synchronisiert**, **Offline – n Änderungen ausstehend**.
- **Faustregel für Nutzer:** *Speichern → Häkchen abwarten (meist 1–2 s) → App schließen.*
- iOS-PWAs synchronisieren nicht im Hintergrund. Offline Erfasstes wird beim nächsten Öffnen mit Netz hochgeladen.

### Wie oft entstehen Konflikte?

Nur wenn **derselbe Datensatz** auf zwei Geräten geändert wird, bevor eines synchronisiert hat. Bei einer Person mit gelegentlich zwei Geräten ist das selten. Unterschiedliche Tage oder Zeiträume werden ohne Rückfrage zusammengeführt.

## 6. Login und Sitzung

- **Anmelden:** Benutzername + Passwort. Das gilt genauso für neue Geräte und nach dem Abmelden.
- **Benutzername:** Supabase benötigt intern eine E-Mail-Adresse. Die App bildet den Benutzernamen daher auf eine Kunstadresse ab, z. B. `anna` → `anna@arbeitszeit.local`. Diese Adresse wird nie angeschrieben, und echte E-Mail-Adressen werden nicht gespeichert. Ob Supabase diese Form akzeptiert, wird zu Beginn von Etappe 1 geprüft; andernfalls wird eine garantiert gültige Domain-Form gewählt.
- **Erster Login:** Das Konto startet mit einem Startpasswort vom Betreiber (`account_status.must_change_password = true`). Die App verlangt vor allem anderen ein eigenes Passwort und setzt das Flag danach über eine Serverfunktion zurück.
- **Passwort-Regeln:** Mindestlänge 8 Zeichen, mindestens ein Buchstabe und eine Ziffer. Das ist in Supabase konfiguriert (Mindestlänge 8, „Letters and digits“) und wird in der App vorab geprüft (`src/domain/auth/passwordRules.ts`). Startpasswörter aus dem Admin-Skript erfüllen die Regeln immer.
- **Passwort vergessen:** Es gibt keinen Selbst-Reset per Mail. Der Betreiber setzt per Admin-Skript ein neues Startpasswort, und beim nächsten Login muss wieder ein eigenes gesetzt werden.
- **Sitzung:** Supabase gibt ein kurzlebiges Zugangs-Token (ca. 1 h) und ein langlebiges Erneuerungs-Token aus. Die App erneuert automatisch, man meldet sich also **einmal pro Gerät** an. Die maximale Sitzungsdauer bzw. das Inaktivitätslimit wird in Supabase konfiguriert, Vorschlag: 90 Tage Inaktivität.
- **iOS:** App installieren („Zum Home-Bildschirm“) und **in der installierten App** anmelden. Installierte PWAs sind von der 7-Tage-Löschregel für Website-Daten ausgenommen, Safari-Tabs nicht.
- **Offline oder abgelaufene Sitzung:** Die App funktioniert lokal weiter, und die Outbox bleibt erhalten. Nach erneutem Login wird synchronisiert.
- **Kein Mailversand:** Registrierung und E-Mail-Bestätigung sind in Supabase ausgeschaltet. Dadurch ist kein Mailanbieter nötig.

## 7. Nutzer verwalten und Datenübernahme

### Admin-Skript (nur lokal beim Betreiber)

Ein Kommandozeilen-Skript im Repo (`scripts/admin/`). Es nutzt den geheimen Service-Schlüssel aus einer lokalen, nicht eingecheckten Datei (`.env.admin.local`).

| Befehl | Zweck |
|---|---|
| `nutzer anlegen <name>` | Konto, Mitgliedschaft in der Organisation und `must_change_password`; gibt ein zufälliges Startpasswort aus |
| `passwort zuruecksetzen <name>` | neues Startpasswort, das beim nächsten Login ersetzt werden muss |
| `nutzer auflisten` | alle Konten mit Status |
| `nutzer loeschen <name>` | Konto und alle Daten endgültig entfernen (auch für DSGVO-Löschanfragen) |

### Neuen Kollegen hinzufügen

1. Der Betreiber führt `nutzer anlegen anna` aus.
2. Er übergibt Benutzername und Startpasswort **persönlich**, nicht per Messenger oder Mail.
3. Der Kollege installiert die App und meldet sich an. Die App verlangt ein eigenes Passwort und die Einwilligung, danach folgt das bekannte Onboarding.

### Neuer App-Ablauf beim Start

- **Nicht angemeldet:** Login-Bildschirm.
- **Startpasswort aktiv:** eigenes Passwort setzen.
- **Einwilligung fehlt:** Einwilligung zur Speicherung von Krankheitstagen einholen.
- **Angemeldet, Konto hat Daten:** Pull, dann direkt in die Übersicht.
- **Angemeldet, Konto leer:** Onboarding (wie heute), danach Upload.

### Bestehende V1.1-Daten auf einem Gerät

| Lokal | Konto | Verhalten |
|---|---|---|
| Daten vorhanden | leer | Anbieten: „Daten dieses Geräts ins Konto übernehmen“ |
| Daten vorhanden | Daten vorhanden | Nachfragen: Konto-Daten verwenden (lokale verwerfen) oder abbrechen. Kein automatisches Mischen |

### Abmelden

**Bis einschließlich Etappe 2** (ohne Sync) bleiben die lokalen Daten beim Abmelden erhalten. Das Gerät hält dann die einzige Kopie, und Löschen wäre ein Datenverlust.

**Ab Etappe 3** (mit Sync) gilt:

| Zustand beim Abmelden | Verhalten |
|---|---|
| Alles synchronisiert | Die lokalen Daten werden **gelöscht**. Beim nächsten Login werden sie in Sekunden neu geladen. Auf dem Gerät bleiben keine Gesundheitsdaten zurück, auch nicht auf geteilten oder weitergegebenen Geräten. |
| Änderungen ausstehend (z. B. offline erfasst) | Warnung „n Änderungen sind noch nicht gesichert“. Man kann zuerst synchronisieren (bei Verbindung) oder bewusst trotzdem abmelden, dann werden die ausstehenden Änderungen verworfen. Es wird nie still gelöscht. |
| Offline, alles synchronisiert | Abmelden und Löschen sind möglich. Hinweis: Zum erneuten Anmelden wird Internet benötigt. |

- **Warnung „Daten eines anderen Kontos“:** Sie bleibt als Sicherheitsnetz bestehen, z. B. für Abmeldungen durch abgelaufene Sitzungen, bei denen nicht gelöscht wurde. Mit dem Löschen beim Abmelden tritt sie im Normalfall aber nicht mehr auf.
- **Abgelaufene oder widerrufene Sitzung:** Hier wird **nicht** automatisch gelöscht, weil ausstehende Änderungen betroffen sein könnten. Nach dem erneuten Login desselben Kontos wird synchronisiert.

## 8. Datenschutz und Sicherheit

**Keine Rechtsberatung.** Vor dem Onboarding weiterer Personen und vor jeder Chef-Ansicht sollte das geprüft werden.

### Einordnung

- **„Krank an Tag X“ ist ein Gesundheitsdatum** (Art. 9 DSGVO).
- **Heutige Konstellation** (Einzelne bzw. Kollegen, privat, ohne Arbeitgeber): Rechtsgrundlage ist die **ausdrückliche Einwilligung** jeder Person. Der Betreiber ist verantwortliche Stelle für den Dienst.
- **Chef-Ansicht:** eine **andere Konstellation**. Der Arbeitgeber wird verantwortlich (§ 26 BDSG), es braucht einen Vertrag mit dem Betreiber. Gibt es einen Betriebsrat, hat er ein Mitbestimmungsrecht (§ 87 Abs. 1 Nr. 6 BetrVG). Die Chef-Ansicht kommt erst, wenn der Arbeitgeber sie aktiv will, und dann nach juristischer Prüfung.

### Wer hat Zugriff?

| Wer | Zugriff | Absicherung |
|---|---|---|
| Nutzer | nur eigene Daten | RLS |
| Betreiber | technisch alle Daten (Supabase-Dashboard) | 2FA auf Supabase und GitHub, kein Einblick ohne Anlass, Service-Key nie im Frontend |
| Supabase | technisch möglich, vertraglich geregelt | Auftragsverarbeitungsvertrag (DPA), EU-Region, Verschlüsselung at rest und in transit |
| Arbeitgeber | keiner | – |

Ende-zu-Ende-Verschlüsselung wird bewusst **nicht** umgesetzt. Sie würde die Chef-Ansicht ausschließen, und ein verlorener Schlüssel bedeutet Datenverlust.

### Maßnahmen in V2

- **Nur das Nötigste speichern:** nur der Status „krank“, keine Diagnosen, keine Freitextfelder zu Krankheit.
- **Datensparsam beim Konto:** Benutzername statt echter E-Mail-Adresse; keine Mails, kein Mailanbieter.
- **Einwilligung:** beim ersten Login ein Einwilligungs-Haken, der Zeitpunkt wird in `profiles.health_data_consent_at` gespeichert.
- **Datenschutzerklärung** in der App: kurz, in einfacher Sprache.
- **Betroffenenrechte:**
  - „Meine Daten exportieren“ (JSON)
  - „Konto und alle Daten löschen“ (echtes Löschen, serverseitig)
- **Schlüssel:** Im Frontend liegen nur Supabase-URL und öffentlicher Schlüssel (`anon`). Die Sicherheit hängt vollständig an RLS.
- **Gerät:** Lokale Daten liegen unverschlüsselt in IndexedDB, geschützt durch die Gerätesperre.
- **Keine Firmendaten:** keine Firmengeräte, keine Firmenkonten, keine Patientendaten.
- **Startpasswörter:** nur persönlich übergeben; sie gelten nur bis zum ersten Login.

## 9. Betrieb

- **Kosten:** Supabase Free Tier, GitHub Pages. Aktuell 0 €.
- **Pausieren:** Gratis-Projekte pausieren nach ca. 1 Woche ohne Zugriffe, z. B. im Urlaub. Die Daten bleiben erhalten, die App arbeitet lokal weiter. Gegenmaßnahme: ein täglicher Ping per GitHub Action oder später der Bezahltarif.
- **Backups:** Der Free Tier bietet **keine** automatischen Backups. Die Absicherung ruht daher auf mehreren Ebenen:
  1. **Local-first als natürliche Kopie:** Jedes angemeldete Gerät hält den vollständigen Datenbestand seines Nutzers.
  2. **Server-Backup durch den Betreiber:** regelmäßiger Datenbank-Dump mit der Supabase-CLI (`supabase db dump`), **verschlüsselt** abgelegt (z. B. mit `age` oder einem verschlüsselten Archiv), mit Schlüssel nur beim Betreiber. Start manuell etwa monatlich und vor jeder Schema-Migration; später optional automatisiert per GitHub Action, die den Dump **vor** dem Speichern verschlüsselt.
  3. **JSON-Export pro Nutzer** in der App (Etappe 6).
  4. **Wiederherstellung** einmal testweise durchspielen: Dump in ein Test-Projekt einspielen.

  Unverschlüsselte Dumps werden nie in Cloud-Speichern oder Repos abgelegt, weil sie Gesundheitsdaten enthalten.
- **Konfiguration:** `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` als GitHub-Actions-Variablen für den Build.

**Free-Tier-Rahmen (bei Einrichtung geprüft):**
- Pausieren nach 1 Woche Inaktivität
- keine automatischen Backups
- 500 MB Datenbank
- 50.000 aktive Nutzer pro Monat
- unbegrenzte API-Anfragen
- 5 GB Datenverkehr pro Monat
- max. 2 aktive Gratis-Projekte

## 10. Umsetzung in Etappen

Jede Etappe ist einzeln lauffähig und testbar.

| # | Etappe | Ergebnis / Abnahme |
|---|---|---|
| 0 | **Vorbereitung** (Betreiber) | Supabase-Projekt in Frankfurt, 2FA, Registrierung und E-Mail-Bestätigung aus, Passwort-Mindestlänge, DPA abgeschlossen, Schlüssel hinterlegt (Anleitung: `docs/V2-Etappe-0.md`) |
| 1 | **Schema, RLS und Admin-Skript** | SQL-Migrationen im Repo; RLS-Tests grün (A sieht B nicht); Admin-Skript legt Konto + Mitgliedschaft an; Kunstadresse als Benutzername geprüft |
| 2 | **Login** | Benutzername + Passwort in der installierten PWA (iOS und Android), Pflicht-Passwortwechsel beim ersten Login, Sitzung bleibt über Neustarts erhalten, Passwort ändern, Abmelden |
| 3 | **Sync (Push/Pull)** | Dexie-Migration (Outbox, Versionen, Sync-Metadaten), Repositories schreiben in die Outbox, Sync-Status-Anzeige; zwei Browser synchronisieren; Offline-Änderungen werden nachgeholt; **Abmelden löscht lokale Daten, wenn alles synchronisiert ist, sonst Warnung mit bewusster Entscheidung** (Abschnitt 7) |
| 4 | **Konflikte** | Konflikterkennung am Server, Konflikt-Dialog; Tests für gleichzeitiges Ändern, Löschen und doppelten Arbeitstag |
| 5 | **Datenübernahme und Startablauf** | Übernahme bestehender V1.1-Daten, Onboarding für leere Konten, Abfrage bei vorhandenen Daten |
| 6 | **Datenschutz-Funktionen** | Einwilligung, Datenschutzerklärung, Export, Konto löschen |
| 7 | **Betrieb** | Keep-alive gegen Pausieren, verschlüsseltes Backup-Skript samt getesteter Wiederherstellung, Anleitung „Nutzer hinzufügen / Passwort zurücksetzen“, README |

### Nicht Teil von V2

- Chef-Ansicht und Admin-Oberfläche
- Rollenverwaltung in der App
- Google-Login (kann später ergänzt werden, falls er in installierten PWAs zuverlässig funktioniert)
- Push-Benachrichtigungen
- Ende-zu-Ende-Verschlüsselung

## 11. Auswirkungen auf den bestehenden Code

- **Unverändert:** `src/domain/**` (Berechnung, Feiertage, Konflikte zwischen Einträgen), alle Views, Day Editor und PDF.
- **Erweitert:**
  - `src/data/db/database.ts`: neue Dexie-Version mit Outbox, Versionen, Konflikten und Metadaten
  - `src/data/repositories/*`: Schreiben inklusive Outbox-Eintrag
- **Neu:**
  - `src/data/sync/` (SyncService, Supabase-Client)
  - `src/features/auth/` (Login, Passwort setzen/ändern, Einwilligung)
  - `src/features/sync/` (Status, Konflikt-Dialog)
  - `supabase/migrations/` (Schema, RLS, `push_changes`)
  - `scripts/admin/` (Nutzerverwaltung, nur lokal)
- **Einstellungen:** neuer Abschnitt „Konto“ (Benutzername, Sync-Status, Passwort ändern, Export, Abmelden, Konto löschen).
