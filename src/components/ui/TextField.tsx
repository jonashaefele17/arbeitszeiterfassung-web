import { useId, useState, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Passwortfeld mit „Anzeigen“-Schalter. */
  revealable?: boolean;
}

/** Beschriftetes Eingabefeld mit großer Touch-Fläche. */
export function TextField({ label, value, onChange, revealable = false, type = 'text', ...props }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const inputType = revealable ? (revealed ? 'text' : 'password') : type;
  return (
    <div>
      <label htmlFor={id} className="block px-1 pb-1.5 text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <div className="flex items-center rounded-2xl bg-surface ring-1 ring-line transition-shadow focus-within:ring-2 focus-within:ring-accent">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-13 w-full min-w-0 flex-1 rounded-2xl bg-transparent px-4 text-[17px] outline-none"
          {...props}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? 'Passwort verbergen' : 'Passwort anzeigen'}
            aria-pressed={revealed}
            className="mr-1 min-h-11 shrink-0 rounded-xl px-3 text-[15px] font-medium text-accent"
          >
            {revealed ? 'Verbergen' : 'Anzeigen'}
          </button>
        )}
      </div>
    </div>
  );
}
