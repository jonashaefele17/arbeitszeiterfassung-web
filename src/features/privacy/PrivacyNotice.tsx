import type { ReactNode } from 'react';
import { OPERATOR } from '../../config/operator';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-5">
      <h3 className="pb-1 text-[17px] font-semibold text-ink">{title}</h3>
      <div className="space-y-2 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

/** Datenschutzhinweise in einfacher Sprache (Stand V2). */
export function PrivacyNotice() {
  const operator = OPERATOR.name
    ? `${OPERATOR.name}${OPERATOR.contact ? `, erreichbar unter ${OPERATOR.contact}` : ''}`
    : 'die Person, die diese App betreibt und dir deinen Zugang gegeben hat';

  return (
    <div className="pb-4">
      <h2 className="pt-1 text-[28px] font-bold tracking-tight">Datenschutz</h2>
      <p className="pt-2 text-[15px] leading-relaxed text-ink-2">
        Diese App ist ein privates Werkzeug zur Erfassung deiner eigenen Arbeitszeiten. Hier steht, welche Daten
        gespeichert werden und welche Rechte du hast.
      </p>

      <Section title="Verantwortlich">
        <p>Verantwortlich für die Datenverarbeitung ist {operator}.</p>
      </Section>

      <Section title="Welche Daten gespeichert werden">
        <ul className="list-disc space-y-1 pl-5">
          <li>dein Benutzername (keine E-Mail-Adresse) und dein Passwort (nur verschlüsselt)</li>
          <li>deine Angaben im Profil: Vor- und Nachname, Urlaubsanspruch, Standardarbeitswoche, Startwerte</li>
          <li>deine Arbeitszeiten, Urlaube, freien Tage auf Überstunden und selbst eingetragenen Feiertage</li>
          <li>
            <strong className="font-semibold text-ink">Krankheitstage</strong> – nur das Datum, keine Diagnosen oder
            Gründe. Das sind Gesundheitsdaten und besonders geschützt.
          </li>
          <li>technisch: Zeitpunkt der letzten Anmeldung</li>
        </ul>
      </Section>

      <Section title="Wozu">
        <p>
          Ausschließlich für deine eigene Arbeitszeiterfassung, zum Abgleich zwischen deinen Geräten und zur Sicherung
          deiner Daten. Es findet keine Auswertung, Weitergabe oder Werbung statt.
        </p>
      </Section>

      <Section title="Rechtsgrundlage">
        <p>
          Deine ausdrückliche Einwilligung (Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a DSGVO), die du beim ersten
          Start erteilst.
        </p>
      </Section>

      <Section title="Wo die Daten liegen">
        <p>
          Beim Dienstleister Supabase in einem Rechenzentrum in Frankfurt am Main (EU). Mit Supabase besteht ein Vertrag
          zur Auftragsverarbeitung. Die Übertragung ist verschlüsselt.
        </p>
        <p>
          Auf deinem Gerät werden die Daten zusätzlich gespeichert, damit die App offline funktioniert. Beim Abmelden
          werden sie vom Gerät entfernt, sobald sie gesichert sind.
        </p>
      </Section>

      <Section title="Wer Zugriff hat">
        <p>
          Du selbst über die App. Andere Nutzer sehen deine Daten nicht. Dein Arbeitgeber hat keinen Zugriff. Der
          Betreiber kann technisch auf die gespeicherten Daten zugreifen, tut dies aber nur, wenn es für den Betrieb
          nötig ist – etwa um dein Passwort zurückzusetzen oder einen Fehler zu beheben.
        </p>
      </Section>

      <Section title="Wie lange">
        <p>Bis du dein Konto löschst. Danach werden alle Daten endgültig entfernt.</p>
      </Section>

      <Section title="Deine Rechte">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="font-semibold text-ink">Auskunft und Kopie:</strong> In den Einstellungen unter
            „Meine Daten exportieren“.
          </li>
          <li>
            <strong className="font-semibold text-ink">Löschung:</strong> In den Einstellungen unter „Konto und Daten
            löschen“ – sofort und endgültig.
          </li>
          <li>
            <strong className="font-semibold text-ink">Widerruf der Einwilligung:</strong> jederzeit, mit Wirkung für
            die Zukunft – durch Löschen deines Kontos oder eine Nachricht an den Betreiber.
          </li>
          <li>Berichtigung deiner Angaben direkt in der App.</li>
          <li>Beschwerde bei einer Datenschutz-Aufsichtsbehörde.</li>
        </ul>
      </Section>
    </div>
  );
}
