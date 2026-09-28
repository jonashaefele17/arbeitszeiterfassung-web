import { LayoutGroup, motion } from 'framer-motion';
import { transitions } from '../../components/ui/motion';

export type EditorKind = 'work' | 'vacation' | 'sick' | 'holiday';

export const KIND_LABEL: Record<EditorKind, string> = {
  work: 'Arbeit',
  vacation: 'Urlaub',
  sick: 'Krank',
  holiday: 'Feiertag',
};

const SECONDARY: EditorKind[] = ['vacation', 'sick', 'holiday'];

interface StatusPickerProps {
  /** `null` → große Auswahl für einen leeren Tag, sonst kompakte Leiste. */
  selected: EditorKind | null;
  onSelect: (kind: EditorKind) => void;
}

/**
 * Statusauswahl. Beim leeren Tag groß („Arbeit“ als wichtigste Option),
 * nach der Auswahl kompakt – die Optionen gleiten per Shared Layout an ihren neuen Platz.
 */
export function StatusPicker({ selected, onSelect }: StatusPickerProps) {
  return (
    <LayoutGroup id="status-picker">
      {selected === null ? (
        <div className="flex flex-col gap-3 pb-2" role="group" aria-label="Status wählen">
          <Option kind="work" onSelect={onSelect} className="min-h-28 rounded-[24px] bg-accent text-[24px] font-semibold text-white" />
          <div className="grid grid-cols-3 gap-3">
            {SECONDARY.map((kind) => (
              <Option
                key={kind}
                kind={kind}
                onSelect={onSelect}
                className="min-h-20 rounded-[20px] bg-fill text-[17px] font-semibold text-ink"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative grid grid-cols-4 gap-1 rounded-2xl bg-fill p-1" role="radiogroup" aria-label="Status">
          {(['work', ...SECONDARY] as EditorKind[]).map((kind) => {
            const active = kind === selected;
            return (
              <motion.button
                key={kind}
                layoutId={`status-${kind}`}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(kind)}
                transition={transitions.layout}
                className={`relative min-h-11 rounded-xl text-[15px] font-semibold transition-colors ${
                  active ? 'text-white' : 'text-ink-2'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="status-active"
                    transition={transitions.layout}
                    className="absolute inset-0 rounded-xl bg-accent"
                  />
                )}
                <span className="relative">{KIND_LABEL[kind]}</span>
              </motion.button>
            );
          })}
        </div>
      )}
    </LayoutGroup>
  );
}

interface OptionProps {
  kind: EditorKind;
  onSelect: (kind: EditorKind) => void;
  className: string;
}

function Option({ kind, onSelect, className }: OptionProps) {
  return (
    <motion.button
      layoutId={`status-${kind}`}
      type="button"
      onClick={() => onSelect(kind)}
      whileTap={{ scale: 0.97 }}
      transition={transitions.layout}
      className={`flex items-center justify-center ${className}`}
    >
      <motion.span layout="position">{KIND_LABEL[kind]}</motion.span>
    </motion.button>
  );
}
