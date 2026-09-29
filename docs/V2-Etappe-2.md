# V2 – Etappe 2: Login in der App

Ziel: Die App startet mit einer Anmeldung per Benutzername und Passwort. Danach funktioniert sie wie bisher, die Daten bleiben weiterhin **nur lokal** auf dem Gerät. Die Synchronisierung folgt in Etappe 3.

## Was die App jetzt kann

- **Login** mit Benutzername und Passwort. Die Sitzung wird gespeichert und automatisch erneuert. Man meldet sich einmal pro Gerät an, danach startet die App auch offline.
- **Startpasswort ersetzen:** Beim ersten Login muss ein eigenes Passwort gesetzt werden. Anforderungen: mindestens 8 Zeichen, mindestens ein Buchstabe und eine Ziffer.
- **Einstellungen → Konto:** Benutzername anzeigen, Passwort ändern (mit Prüfung des aktuellen Passworts), abmelden. Beim Abmelden bleiben die Daten auf dem Gerät.
- **Schutz beim Gerätewechsel:**
  - Die App merkt sich, welchem Konto die lokalen Daten gehören.
  - Meldet sich ein anderes Konto an, erscheint „Daten eines anderen Kontos“. Man kann dann abmelden oder die Gerätedaten nach Rückfrage löschen.
  - Bestehende Daten aus V1.1 werden beim ersten Login dem angemeldeten Konto zugeordnet.

## Vor dem Deployment (Betreiber)

**Wichtig:** Sobald diese Version live ist, verlangt die App auf **jedem** Gerät eine Anmeldung. Deshalb vorher:

- [ ] **Passwort-Einstellungen in Supabase** (Authentication → Passwort): Mindestlänge **8**, Zeichenanforderung **„Letters and digits“**.
- [ ] **GitHub-Variable `VITE_SUPABASE_URL`** prüfen: nur `https://<projekt-id>.supabase.co`, ohne `/rest/v1/`. Außerdem muss `VITE_SUPABASE_ANON_KEY` gesetzt sein. Fehlen die Variablen, zeigt die App „Anmeldung nicht eingerichtet“.
- [ ] **Konten anlegen** und die Startpasswörter notieren bzw. persönlich übergeben:

  ```bash
  npm run admin -- anlegen <dein-name>
  npm run admin -- anlegen <name-der-kollegin>
  ```

- [ ] **Nutzer vorwarnen:** Nach dem nächsten Öffnen erscheint ein Login. Die vorhandenen Daten auf dem Handy bleiben erhalten und werden beim ersten Login automatisch dem Konto zugeordnet. Deshalb sollte sich auf jedem Handy **zuerst die Person anmelden, der die Daten gehören**.

## Tests

- **Unit-Tests:** Passwort-Regeln und Benutzernamen (`npm test`).
- **Browser-Test gegen das echte Projekt**, mit temporären Konten:
  - Login mit falschem und richtigem Passwort
  - Pflicht-Passwortwechsel, danach das Onboarding
  - Angemeldet bleiben nach dem Neuladen
  - Offline-Start
  - Passwort ändern
  - Abmelden und wieder anmelden, die Daten bleiben erhalten
  - Warnung bei einem anderen Konto auf demselben Gerät
