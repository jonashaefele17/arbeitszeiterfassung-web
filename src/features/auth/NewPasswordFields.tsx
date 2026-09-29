import { TextField } from '../../components/ui/TextField';
import { PASSWORD_RULES, isPasswordValid } from '../../domain/auth/passwordRules';

interface NewPasswordFieldsProps {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
}

/** Neues Passwort + Wiederholung mit live abgehakten Anforderungen. */
export function NewPasswordFields({ password, confirmation, onPasswordChange, onConfirmationChange }: NewPasswordFieldsProps) {
  const mismatch = confirmation.length > 0 && confirmation !== password;
  return (
    <div className="space-y-4">
      <TextField
        label="Neues Passwort"
        value={password}
        onChange={onPasswordChange}
        revealable
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <ul className="space-y-1 px-1" aria-label="Passwort-Anforderungen">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className={`flex items-center gap-2 text-[15px] ${ok ? 'text-ink' : 'text-ink-3'}`}>
              <span
                aria-hidden
                className={`flex size-5 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                  ok ? 'bg-accent text-white' : 'bg-fill text-ink-3'
                }`}
              >
                ✓
              </span>
              {rule.label}
              <span className="sr-only">{ok ? 'erfüllt' : 'nicht erfüllt'}</span>
            </li>
          );
        })}
      </ul>
      <TextField
        label="Passwort wiederholen"
        value={confirmation}
        onChange={onConfirmationChange}
        type="password"
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={mismatch}
      />
      {mismatch && <p className="px-1 text-[15px] text-danger">Die Passwörter stimmen nicht überein.</p>}
    </div>
  );
}

export function canSubmitNewPassword(password: string, confirmation: string): boolean {
  return isPasswordValid(password) && password === confirmation;
}
