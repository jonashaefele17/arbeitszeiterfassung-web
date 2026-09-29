# V2 – Etappe 0: Vorbereitung (Anleitung für den Betreiber)

Ziel: Das Supabase-Projekt ist so eingerichtet und abgesichert, dass Etappe 1 (Schema, Zugriffsregeln, Admin-Skript) starten kann. Aufwand: ca. 30–60 Minuten. Hintergrund und Entscheidungen stehen in [V2-Konzept.md](V2-Konzept.md).

**Reihenfolge:** zuerst die Zugänge absichern, dann das anlegen, was sich später nicht mehr ändern lässt, dann alles abschotten, bevor echte Daten fließen.

> Supabase ändert seine Oberfläche gelegentlich. Die Menüpfade entsprechen dem Stand bei Erstellung. Wenn etwas anders heißt, nach dem genannten Begriff suchen.

---

## Schritt 1 – Zugänge absichern

**Was:** Zwei-Faktor-Anmeldung (2FA) für **GitHub** einschalten (Settings → Password and authentication) und für das **E-Mail-Postfach**, mit dem du dich bei GitHub/Supabase anmeldest.

**Warum zuerst:** Diese Konten sind die Generalschlüssel. Über GitHub kommt man an Code und Deployment. Über das Postfach setzt man Passwörter dieser Konten zurück. Alles Weitere ist nur so sicher wie diese beiden.

## Schritt 2 – Supabase-Konto anlegen

**Was:**

1. Auf supabase.com registrieren, am einfachsten mit „Continue with GitHub“.
2. Sofort 2FA einschalten (Account → Security, „Multi-Factor Authentication“).
3. Eine Organisation im **Free Plan** anlegen. Das ist die Supabase-Organisation, nicht die App-Organisation.

**Warum:** Über dieses Konto hast du technisch Zugriff auf alle Daten aller Nutzer. Es ist der sensibelste Zugang im System.

## Schritt 3 – Projekt anlegen (Region Frankfurt)

**Was:**

- **Name:** z. B. `arbeitszeit`
- **Database Password:** generieren lassen und im Passwort-Manager speichern
- **Region:** Central EU (Frankfurt)

**Warum jetzt und sorgfältig:**

- Die **Region lässt sich später nicht ändern**, ein Wechsel hieße neues Projekt und Umzug.
- Frankfurt bedeutet, dass die Gesundheitsdaten in Deutschland liegen. Das ist die Grundlage der Datenschutz-Argumentation.
- Das Datenbank-Passwort brauchst du in Etappe 1 für die Migrationen. Es gehört nie in den Code, in einen Chat oder an Dritte.

## Schritt 4 – Anmeldung einstellen

**Wann:** direkt nach dem Anlegen, bevor irgendjemand die Projekt-URL kennt. Menü: **Authentication** (Unterpunkte wie „Sign In / Providers“, „Policies“ oder „URL Configuration“).

1. **Registrierung ausschalten:** „Allow new users to sign up“ deaktivieren.
   *Warum:* Nur du legst Konten an. Niemand kann sich selbst registrieren.
2. **E-Mail-Bestätigung ausschalten:** „Confirm email“ deaktivieren. Der Provider „Email“ selbst bleibt **aktiv**, er ist der Passwort-Login.
   *Warum:* Wir nutzen Benutzernamen, die intern als Kunstadresse gespeichert werden. Es wird nie eine Mail verschickt, deshalb brauchen wir keinen Mailanbieter.
3. **Passwort-Mindestlänge** auf **10 Zeichen** setzen. Falls es Anforderungen an Zeichenarten gibt, z. B. Ziffern: optional.
   *Warum:* Ohne Selbst-Reset per Mail ist ein starkes Passwort der wichtigste Schutz des Kontos.
4. **URL-Konfiguration:**
   - Site URL: `https://jonashaefele17.github.io/arbeitszeiterfassung-web/`
   - Redirect URLs zusätzlich: `http://localhost:5173/**`

   *Warum:* Supabase prüft Anfragen gegen diese Adressen. Localhost brauchen wir für die Entwicklung.
5. **Sitzungsdauer:** Gibt es eine Option für ein Inaktivitäts-Timeout, 90 Tage einstellen. Ist sie nur im Bezahltarif verfügbar, auf dem Standard lassen: Man bleibt dann angemeldet, bis man sich abmeldet.

## Schritt 5 – Auftragsverarbeitungsvertrag (DPA) mit Supabase

**Was:** Den Data Processing Agreement von Supabase anfordern bzw. unterzeichnen. Er ist im Dashboard oder über die Legal-/Privacy-Seite von Supabase erreichbar. Das PDF ablegen.

**Warum und wann:** **Bevor echte Daten gespeichert werden.** Supabase speichert Gesundheitsdaten (Krankheitstage). Der Vertrag legt fest, dass Supabase sie nur in deinem Auftrag verarbeitet. Das ist die Voraussetzung, Daten anderer Personen dort zu speichern.

Da es keinen Mailanbieter gibt, entfällt ein zweiter Vertrag.

## Schritt 6 – Schlüssel für die App hinterlegen

**Was:**

1. In Supabase unter **Project Settings → API** (bzw. „API Keys“) zwei Werte kopieren:
   - die **Project URL**, nur die Basisadresse `https://<projekt-id>.supabase.co`, **ohne** `/rest/v1/` (die Data-API-Seite zeigt die längere Adresse an)
   - den **öffentlichen Schlüssel**, je nach Oberfläche „anon“ oder „publishable“ genannt
2. Auf GitHub im Repo unter **Settings → Secrets and variables → Actions → Variables** anlegen:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Lokal im Projektordner eine Datei `.env.local` mit denselben zwei Zeilen anlegen. Sie ist über `.gitignore` bereits ausgeschlossen.

   ```text
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```

**Warum:** Die App braucht diese Werte beim Bauen. Der öffentliche Schlüssel darf im Frontend stehen, die Sicherheit kommt aus den Zugriffsregeln in der Datenbank (Etappe 1).

> **Nie** ins Repo, in GitHub-Variablen, in Chats oder an Dritte:
> - den **service_role- bzw. Secret-Schlüssel**
> - das **Datenbank-Passwort**
>
> Wer sie hat, umgeht alle Zugriffsregeln. Den Service-Schlüssel braucht nur das Admin-Skript. Er kommt in Etappe 1 in eine lokale Datei `.env.admin.local`, die ebenfalls nicht eingecheckt wird.

## Schritt 7 – Rahmenbedingungen notieren

**Was:** Auf der Pricing- bzw. Free-Plan-Seite von Supabase nachlesen und hier notieren:

| Frage | Notiz |
|---|---|
| Ab wann pausieren Gratis-Projekte bei Inaktivität? | nach **1 Woche** ohne Aktivität; max. 2 aktive Gratis-Projekte |
| Welche Backups gibt es im Free Plan? | **keine** automatischen/geplanten Backups → eigenes Backup nötig (siehe V2-Konzept, Abschnitt 9) |
| Grenzen (Datenbankgröße, Nutzerzahl, Anfragen)? | 500 MB Datenbank, 50.000 aktive Nutzer/Monat, unbegrenzte API-Anfragen, 5 GB Datenverkehr/Monat, 1 GB Dateispeicher (Stand der Preisseite bei Einrichtung) |

**Warum:** Davon hängt ab, was in Etappe 7 für den Betrieb nötig ist, z. B. ein Schutz gegen das Pausieren oder ein eigenes Backup.

---

## Checkliste

- [ ] 2FA: GitHub, E-Mail-Postfach, Supabase
- [ ] Supabase-Projekt in **Frankfurt**, Datenbank-Passwort im Passwort-Manager
- [ ] Registrierung **aus**
- [ ] E-Mail-Bestätigung **aus** (Provider „Email“ bleibt an)
- [ ] Passwort-Mindestlänge 10
- [ ] Site URL und Redirect URLs gesetzt
- [ ] DPA mit Supabase abgelegt
- [ ] `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` auf GitHub und in `.env.local`
- [ ] Free-Plan-Rahmenbedingungen notiert

Danach geht es mit **Etappe 1** weiter: Datenbankschema, Zugriffsregeln inklusive Tests und das Admin-Skript zum Anlegen der Konten.
