# V2 – Etappe 4: Konflikte klären

Ziel: Wenn ein Eintrag auf zwei Geräten unterschiedlich geändert wurde, entscheidet der Nutzer, welcher Stand gilt. Es wird nie still überschrieben.

## Ablauf in der App

1. **Hinweis:** Sobald ein Konflikt erkannt ist, erscheint oben ein Hinweisband: „1 Eintrag wurde auf zwei Geräten unterschiedlich geändert. **Klären**“. Das Sync-Symbol zeigt „!“ und öffnet beim Antippen ebenfalls den Dialog.
2. **Dialog:** Er zeigt beide Stände nebeneinander, **Dieses Gerät** und **Anderes Gerät**, in verständlicher Form, z. B. „Arbeit · 08:00–15:00 · Pause 30 min · 6,5 h“, „Urlaub 14.09.–18.09.2026“ oder „Gelöscht“.
3. **Entscheidung:**
   - **„Diesen Stand behalten“:** Der Stand dieses Geräts wird hochgeladen und ersetzt den anderen. Dafür wird eine Internetverbindung benötigt.
   - **„Anderen Stand übernehmen“:** Der Stand des anderen Geräts ersetzt den lokalen. Das funktioniert auch offline.
4. **Mehrere Konflikte** werden nacheinander geklärt. Die Überschrift zeigt dabei „noch n“.

## Sonderfälle

| Fall | Verhalten |
|---|---|
| Anderes Gerät hat den Eintrag **gelöscht** | Beim anderen Gerät steht „Gelöscht“. Behalten stellt den Eintrag wieder her, Übernehmen löscht ihn auch hier. |
| **Gleicher Tag auf zwei Geräten angelegt** (z. B. offline) | Behalten markiert den Eintrag des anderen Geräts am Server als gelöscht und lädt den eigenen hoch. Übernehmen ersetzt den eigenen durch den anderen. |
| Anderes Gerät ändert den Eintrag **nach** dem Konflikt erneut | Der Dialog zeigt immer den neuesten Stand. Wird „behalten“ gewählt, während der Server sich gerade erneut geändert hat, entsteht ein neuer Konflikt mit dem aktuellen Stand, statt zu überschreiben. |
| Abmelden mit offenem Konflikt | Warnung „Nicht alle Änderungen sind gesichert“ (Etappe 3) |

## Umsetzung

- **Logik** in `src/data/sync/syncEngine.ts`:
  - `listConflicts()`: beide Stände im App-Format
  - `resolveConflict(ctx, key, 'local' | 'remote')`
  - Beim Abholen aktualisiert die App bei offenen Konflikten den gespeicherten Serverstand.
- **Oberfläche** in `src/features/sync/`:
  - `ConflictSheet.tsx`: Hinweisband und Dialog
  - `describeRecord.ts`: verständliche Texte je Eintragsart

## Tests

- **Unit-Tests:**
  - beide Entscheidungen, „Übernehmen“ auch offline
  - neuester Serverstand im Dialog
  - Löschung am anderen Gerät
  - gleicher Tag in beiden Varianten
  - erneute Änderung während der Entscheidung
- **Browser-Test mit zwei Geräten gegen das echte Projekt:** Hinweisband, Dialog mit beiden Ständen, „behalten“ (das andere Gerät übernimmt), „übernehmen“, Öffnen über das Sync-Symbol und gleicher Tag auf zwei Geräten.
