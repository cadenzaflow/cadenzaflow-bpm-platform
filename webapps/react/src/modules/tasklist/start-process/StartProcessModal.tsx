import { useEffect, useState } from 'react';
import {
  Button,
  ContainedList,
  ContainedListItem,
  InlineNotification,
  Modal,
  PaginationNav,
  Search,
  SkeletonText,
  Tag,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuthentication } from '../../../shared/auth/authentication';
import { notify } from '../../../shared/notifications';
import { useAssignNotification } from '../assign-notification';
import { useFormInfo, useSubmitForm } from '../forms/api';
import { resolveForm } from '../forms/form-key';
import { FormRenderer } from '../forms/FormRenderer';
import type { FormTarget } from '../forms/target';
import { START_PAGE_SIZE, useStartableDefinition, useStartableDefinitions, type StartableDefinition } from './api';

interface StartProcessModalProps {
  engine: string;
  open: boolean;
  /** Pre-selected definition (from the ?processStart link). */
  definitionKey?: string;
  tenantId?: string;
  onSelect: (definition: StartableDefinition | null) => void;
  onClose: () => void;
}

const label = (definition: StartableDefinition) => definition.name || definition.key;

/** Pick a process the user may start, fill in its start form, start it. */
export function StartProcessModal({ engine, open, definitionKey, tenantId, onSelect, onClose }: StartProcessModalProps) {
  const { t } = useTranslation('tasklist');
  const preselected = useStartableDefinition(engine, definitionKey, tenantId);
  const [selected, setSelected] = useState<StartableDefinition | null>(null);

  useEffect(() => {
    if (preselected.data !== undefined) {
      setSelected(preselected.data);
    }
  }, [preselected.data]);

  const select = (definition: StartableDefinition | null) => {
    setSelected(definition);
    onSelect(definition);
  };

  return (
    <Modal
      open={open}
      passiveModal
      size="lg"
      modalHeading={selected ? label(selected) : t('START_PROCESS')}
      onRequestClose={onClose}
    >
      {selected ? (
        <StartForm engine={engine} definition={selected} onBack={() => select(null)} onStarted={onClose} />
      ) : (
        <DefinitionList engine={engine} open={open} onSelect={select} />
      )}
    </Modal>
  );
}

function DefinitionList({
  engine,
  open,
  onSelect,
}: {
  engine: string;
  open: boolean;
  onSelect: (definition: StartableDefinition) => void;
}) {
  const { t } = useTranslation('tasklist');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const definitions = useStartableDefinitions(engine, search, page, open);

  // search while typing, without a request per key
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const pageCount = definitions.data ? Math.ceil(definitions.data.count / START_PAGE_SIZE) : 0;

  return (
    <div className="cz-start-process">
      <Search
        size="lg"
        labelText={t('SEARCH_PROCESS_BY_NAME')}
        placeholder={t('SEARCH_PROCESS_BY_NAME')}
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      {definitions.isPending && <SkeletonText paragraph lineCount={4} />}
      {definitions.isError && (
        <InlineNotification kind="error" lowContrast hideCloseButton subtitle={definitions.error.message} />
      )}
      {definitions.data?.count === 0 && <p className="cz-tasklist__empty">{t('NO_PROCESS_DEFINITION_AVAILABLE')}</p>}
      {!!definitions.data?.count && (
        <ContainedList label={t('CLICK_PROCESS_TO_START')} kind="on-page">
          {definitions.data.definitions.map((definition) => (
            <ContainedListItem key={definition.id} onClick={() => onSelect(definition)}>
              <span className="cz-filter">
                <span>{label(definition)}</span>
                {definition.tenantId && (
                  <Tag size="sm" type="cool-gray" title={t('TENANT_ID')}>
                    {definition.tenantId}
                  </Tag>
                )}
              </span>
            </ContainedListItem>
          ))}
        </ContainedList>
      )}
      {pageCount > 1 && (
        <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={5} onChange={(index: number) => setPage(index + 1)} />
      )}
    </div>
  );
}

function StartForm({
  engine,
  definition,
  onBack,
  onStarted,
}: {
  engine: string;
  definition: StartableDefinition;
  onBack: () => void;
  onStarted: () => void;
}) {
  const { t } = useTranslation('tasklist');
  const target: FormTarget = { kind: 'start', processDefinitionId: definition.id, processDefinitionKey: definition.key };
  const formInfo = useFormInfo(engine, target);
  const userId = useAuthentication(engine).data?.userId;
  const notifyAssigned = useAssignNotification(engine);
  const submitForm = useSubmitForm(engine, target, {
    onSuccess: (result) => {
      notify({ kind: 'success', title: t('PROCESS_START_OK') });
      void notifyAssigned(userId, (result as { id?: string } | null)?.id);
      onStarted();
    },
    onError: (error) => notify({ kind: 'error', title: t('PROCESS_START_ERROR'), subtitle: error.message }),
  });

  return (
    <div className="cz-start-process">
      <Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={onBack}>
        {t('BACK')}
      </Button>
      {formInfo.isPending ? (
        <SkeletonText paragraph lineCount={3} />
      ) : (
        <FormRenderer
          form={
            formInfo.isError
              ? { type: 'error', message: formInfo.error.message }
              : resolveForm(formInfo.data, engine, target)
          }
          engine={engine}
          target={target}
          disabled={false}
          submitting={submitForm.isPending}
          submitLabel={t('START')}
          submit={(variables, businessKey) =>
            submitForm.mutateAsync({ variables, businessKey }).then(() => true, () => false)
          }
        />
      )}
    </div>
  );
}
