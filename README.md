# Arbeitszeit – PWA zur Arbeitszeiterfassung (V1)

Mobile-first Progressive Web App für einen einzelnen Mitarbeiter. Alle Daten bleiben lokal im Browser (IndexedDB). Es gibt kein Backend und keinen Login.

## Befehle

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Tests der Domain-Logik (Vitest)
npm run build      # Typecheck + Produktionsbuild inkl. Service Worker
npm run preview    # Build lokal ausliefern (PWA/Offline testen)
```

App-Icons neu erzeugen: `node scripts/generate-icons.mjs`

## Architektur

```
UI (features/, components/)
  → Domain (domain/: Berechnung, Feiertage, Konfliktprüfung – ohne React/IndexedDB)
  → Repositories (data/repositories/types.ts – fachliche Interfaces)
  → Dexie (data/db, data/repositories/dexieRepositories.ts)
  → IndexedDB
```

- Die UI importiert Daten nur über `data/repositories` und `data/live.ts`. Für V2 wird in `data/repositories/index.ts` eine API-Implementierung eingesetzt.
- Monats- und Kontowerte werden nie gespeichert, sondern immer aus den Rohdaten berechnet (`domain/calculations`).
- Zustand (`stores/`) enthält nur UI-Zustand.

## Fachliche Regeln (abweichend vom bzw. ergänzend zum Master-Prompt abgestimmt)

- **Priorität:** Expliziter Arbeitstag > Feiertag (gesetzlich/manuell) > Krank > Urlaub > leer. Ein Feiertag im Urlaub kostet keinen Urlaubstag. Eine Krankheit im Urlaub gibt den Urlaubstag zurück.
- **Soll:** Leere reguläre Arbeitstage zählen nur zwischen Kontostart und heute als Minus. Das Konto beginnt mit einem Startsaldo aus dem Onboarding.
- **Standardwoche** ist versioniert (gültig ab). Änderungen wirken nicht rückwirkend.
- **Feiertage Bayern:** nur landesweit einheitliche, ohne Mariä Himmelfahrt und ohne Augsburger Friedensfest. Diese lassen sich als manuelle Feiertage setzen.
- Keine Rundung, alle Werte in ganzen Minuten.
