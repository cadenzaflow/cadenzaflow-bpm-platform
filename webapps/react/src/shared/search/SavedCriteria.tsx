import { useState } from 'react';
import { Button, InlineNotification, Modal, Stack, TextInput } from '@carbon/react';
import { Save, TrashCan } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import type { Criterion } from './criteria';
import { readCriteriaSets, writeCriteriaSets } from './saved-criteria';

interface SavedCriteriaProps {
  /** the search the sets belong to, e.g. the process instances of a definition */
  group: string;
  /** the criteria of the search now */
  criteria: Criterion[];
  onLoad: (criteria: Criterion[]) => void;
}

/** Saves the criteria of a search under a name and brings saved ones back. */
export function SavedCriteria({ group, criteria, onLoad }: SavedCriteriaProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState(() => readCriteriaSets(group));
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);
  const names = Object.keys(sets).sort((a, b) => a.localeCompare(b));

  const store = (next: typeof sets) => {
    setFailed(!writeCriteriaSets(group, next));
    setSets(next);
  };

  return (
    <>
      <Button
        kind="ghost"
        size="sm"
        hasIconOnly
        renderIcon={Save}
        iconDescription={t('SAVED_CRITERIA')}
        disabled={!criteria.length && !names.length}
        onClick={() => {
          setSets(readCriteriaSets(group));
          setFailed(false);
          setOpen(true);
        }}
      />
      {open && (
        <Modal open passiveModal size="sm" modalHeading={t('SAVED_CRITERIA')} onRequestClose={() => setOpen(false)}>
          <Stack gap={5}>
            <form
              className="cz-saved-criteria__save"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim() && criteria.length) {
                  store({ ...sets, [name.trim()]: criteria });
                  setName('');
                }
              }}
            >
              <TextInput
                id={`cz-saved-criteria-${group}`}
                labelText={t('SAVED_CRITERIA_NAME')}
                size="sm"
                value={name}
                disabled={!criteria.length}
                onChange={(event) => setName(event.target.value)}
                data-modal-primary-focus
              />
              <Button type="submit" size="sm" disabled={!name.trim() || !criteria.length}>
                {t('SAVED_CRITERIA_SAVE')}
              </Button>
            </form>
            {failed && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={t('SAVED_CRITERIA_NOT_KEPT')} />}
            {names.length === 0 && <p className="cz-list-empty">{t('SAVED_CRITERIA_NONE')}</p>}
            {names.length > 0 && (
              <ul className="cz-saved-criteria__sets">
                {names.map((set) => (
                  <li key={set}>
                    <Button
                      kind="ghost"
                      size="sm"
                      className="cz-link-button"
                      onClick={() => {
                        onLoad(sets[set]);
                        setOpen(false);
                      }}
                    >
                      {set}
                    </Button>
                    <Button
                      kind="ghost"
                      size="sm"
                      hasIconOnly
                      renderIcon={TrashCan}
                      iconDescription={t('SAVED_CRITERIA_DELETE', { name: set })}
                      onClick={() => {
                        const { [set]: _removed, ...rest } = sets;
                        store(rest);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Stack>
        </Modal>
      )}
    </>
  );
}
