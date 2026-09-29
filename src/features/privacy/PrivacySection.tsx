import { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/TextField';
import { ValueRow } from '../../components/ui/ValueRow';
import { AUTH_ERROR_TEXT, AuthError } from '../../data/auth/authRepository';
import { exportRepository } from '../../data/repositories/exportRepository';
import { useToastStore } from '../../stores/toastStore';
import { todayISO } from '../../utils/date';
import { runSafely } from '../../utils/errors';
import { shareOrDownload } from '../../utils/shareFile';
import { useAuthStore } from '../auth/authStore';
import { SettingsSection } from '../settings/SettingsSection';
import { PrivacyNotice } from './PrivacyNotice';

/** Einstellungen → Datenschutz: Hinweise, Export, Konto löschen. */
export function PrivacySection() {
  const auth = useAuthStore((s) => s.state);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [showNotice, setShowNotice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (auth.status !== 'signed-in') return null;
  const { username } = auth.user;

  const exportData = () =>
    runSafely(async () => {
      const data = await exportRepository.exportAll(username);
      const file = new File([JSON.stringify(data, null, 2)], `Arbeitszeit-Daten_${username}_${todayISO()}.json`, {
        type: 'application/json',
      });
      await shareOrDownload(file);
    }, 'Der Export ist fehlgeschlagen. Bitte versuche es erneut.');

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      useToastStore.getState().show('Konto und Daten gelöscht');
    } catch (e) {
      setDeleteError(AUTH_ERROR_TEXT[e instanceof AuthError ? e.code : 'unknown']);
      setDeleting(false);
    }
  };

  return (
    <>
      <SettingsSection
        title="Datenschutz"
        footer="Beim Löschen werden dein Konto und alle Daten auf dem Server und diesem Gerät endgültig entfernt."
      >
        <ValueRow label="Datenschutzhinweise" value="Lesen" onClick={() => setShowNotice(true)} />
        <ValueRow label="Meine Daten" value="Exportieren" onClick={() => void exportData()} />
        <button
          type="button"
          onClick={() => {
            setTyped('');
            setDeleteError(null);
            setConfirmDelete(true);
          }}
          className="flex min-h-13 w-full items-center text-left text-[17px] font-medium text-danger"
        >
          Konto und Daten löschen
        </button>
      </SettingsSection>

      <BottomSheet open={showNotice} onClose={() => setShowNotice(false)} label="Datenschutzhinweise">
        <PrivacyNotice />
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Konto endgültig löschen?"
        confirmLabel={deleting ? 'Wird gelöscht …' : 'Endgültig löschen'}
        destructive
        confirmDisabled={typed.trim().toLowerCase() !== username || deleting}
        onConfirm={() => void remove()}
        onCancel={() => !deleting && setConfirmDelete(false)}
      >
        <p>
          Dein Konto und alle Arbeitszeiten, Urlaube und Krankheitstage werden auf dem Server und auf diesem Gerät
          gelöscht. Das kann nicht rückgängig gemacht werden. Tipp: Exportiere deine Daten vorher.
        </p>
        <div className="pt-4">
          <TextField
            label={`Zur Bestätigung „${username}“ eingeben`}
            value={typed}
            onChange={setTyped}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        {deleteError && <p className="pt-2 text-danger">{deleteError}</p>}
      </ConfirmDialog>
    </>
  );
}
