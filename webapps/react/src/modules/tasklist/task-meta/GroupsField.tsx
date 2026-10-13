import { useState } from 'react';
import { Button, InlineNotification, Modal, SkeletonText, Tag, TextInput } from '@carbon/react';
import { Add, Edit } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { useChangeGroup, useTaskGroups } from './api';

/** The task's candidate groups, managed in a dialog. */
export function GroupsField({ engine, taskId }: { engine: string; taskId: string }) {
  const { t } = useTranslation('tasklist');
  const groups = useTaskGroups(engine, taskId);
  const [open, setOpen] = useState(false);

  return (
    <div className="cz-task__field">
      <dt>{t('GROUPS')}</dt>
      <dd className="cz-task__editable">
        {groups.data?.length ? (
          <span>{groups.data.map((group) => group.name).join(', ')}</span>
        ) : (
          !groups.isPending && <span className="cz-history__empty-value">–</span>
        )}
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={groups.data?.length ? Edit : Add}
          iconDescription={t(groups.data?.length ? 'MANAGE_GROUPS' : 'ADD_GROUPS')}
          onClick={() => setOpen(true)}
        />
      </dd>
      {open && <GroupsModal engine={engine} taskId={taskId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function GroupsModal({ engine, taskId, onClose }: { engine: string; taskId: string; onClose: () => void }) {
  const { t } = useTranslation('tasklist');
  const groups = useTaskGroups(engine, taskId);
  const change = useChangeGroup(engine, taskId);
  const [groupId, setGroupId] = useState('');
  const duplicate = !!groups.data?.some((group) => group.id === groupId.trim());

  const add = () =>
    change.mutate(
      { groupId: groupId.trim() },
      {
        onSuccess: () => setGroupId(''),
        onError: (error) => notify({ kind: 'error', title: t('GROUP_ADD_ERROR'), subtitle: error.message }),
      },
    );

  return (
    <Modal open passiveModal modalHeading={t('MANAGE_GROUPS')} onRequestClose={onClose}>
      <div className="cz-groups">
        <p className="cz-form-hint">{t('USE_ADD_GROUP')}</p>
        <div className="cz-groups__add">
          <TextInput
            id="cz-group-id"
            labelText={t('GROUP_ID')}
            value={groupId}
            invalid={duplicate}
            invalidText={t('DUPLICATE_GROUP')}
            onChange={(event) => setGroupId(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && groupId.trim() && !duplicate && add()}
          />
          <Button
            kind="tertiary"
            renderIcon={Add}
            disabled={!groupId.trim() || duplicate || change.isPending}
            onClick={add}
          >
            {t('GROUP_ADD')}
          </Button>
        </div>
        <h3 className="cz-history__date">{t('CURRENT_GROUPS')}</h3>
        {groups.isPending && <SkeletonText paragraph lineCount={2} />}
        {groups.isError && (
          <InlineNotification kind="error" lowContrast hideCloseButton subtitle={t('INIT_GROUPS_FAILURE')} />
        )}
        <div className="cz-groups__list">
          {groups.data?.map((group) => (
            <Tag
              key={group.id}
              type="cool-gray"
              filter
              title={t('GROUP_REMOVE')}
              disabled={change.isPending}
              onClose={() =>
                change.mutate(
                  { groupId: group.id, remove: true },
                  { onError: (error) => notify({ kind: 'error', title: t('GROUP_DELETE_ERROR'), subtitle: error.message }) },
                )
              }
            >
              {group.name}
            </Tag>
          ))}
        </div>
      </div>
    </Modal>
  );
}
