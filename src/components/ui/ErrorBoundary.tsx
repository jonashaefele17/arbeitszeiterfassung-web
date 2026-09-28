import { Component, type ReactNode } from 'react';

interface State {
  hasError: boolean;
}

/** Fängt unerwartete Fehler ab und zeigt eine verständliche Meldung statt technischer Details. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-[22px] font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="text-[15px] text-ink-2">
          Deine Daten sind sicher auf diesem Gerät gespeichert. Bitte lade die App neu.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 min-h-12 rounded-2xl bg-accent px-6 text-[17px] font-semibold text-white"
        >
          Neu laden
        </button>
      </div>
    );
  }
}
