import { useState } from 'react';
import { Button, InlineNotification, Modal, SkeletonText, Stack, TextInput } from '@carbon/react';
import { Add, Misuse } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../../shared/notifications';
import { ListTable, type Column } from '../../../../shared/ui/ListTable';
import { useChangeIdentityLink, useIdentityLinks, type IdentityLink, type LinkKey } from './api';

const TEXTS: Record<LinkKey, { title: string; current: string; id: string; add: string; addFailed: string; removeFailed: string }> = {
  groupId: {
    title: 'PLUGIN_USER_TASKS_MANAGE_GROUPS',
    current: 'PLUGIN_USER_TASKS_CURRENT_GROUPS',
    id: 'PLUGIN_USER_TASKS_GROUP_ID',
    add: 'PLUGIN_USER_TASKS_ADD_GROUP',
    addFailed: 'PLUGIN_USER_TASKS_NOTIFICATION_ADD_GROUP',
    removeFailed: 'PLUGIN_USER_TASKS_NOTIFICATION_REMOVE_GROUP',
  },
  userId: {
    title: 'PLUGIN_USER_TASKS_MANAGE_USERS',
    current: 'PLUGIN_USER_TASKS_CURRENT_USERS',
    id: 'PLUGIN_USER_TASKS_USER_ID',
    add: 'PLUGIN_USER_TASKS_ADD_USER',
    addFailed: 'PLUGIN_USER_TASKS_NOTIFICATION_ADD_USER',
    removeFailed: 'PLUGIN_USER_TASKS_NOTIFICATION_REMOVE_USER',
  },
};

interface IdentityLinksModalProps {
  engine: string;
  taskId: string;
  /** what is managed: candidate groups or candidate users */
  linkKey: LinkKey;
  onClose: () => void;
}

/** The candidate groups or users of a task: listed, removed and added. */
export function IdentityLinksModal({ engine, taskId, linkKey, onClose }: IdentityLinksModalProps) {
  const { t } = useTranslation('cockpit');
  const texts = TEXTS[linkKey];
  const links = useIdentityLinks(engine, taskId, linkKey);
  const change = useChangeIdentityLink(engine, taskId);
  const [newId, setNewId] = useState('');
  const id = newId.trim();
  const exists = !!links.data?.some((link) => link[linkKey] === id);

  const add = () =>
    change.mutate(
      { link: { [linkKey]: id, type: 'candidate' } },
      {
        onSuccess: () => setNewId(''),
        onError: (error) => notify({ kind: 'error', title: t(texts.addFailed), subtitle: error.message }),
      },
    );

  const columns: Column<IdentityLink & { id: string }>[] = [
    { key: 'id', header: t(texts.id), render: (link) => link.id },
    {
      key: 'action',
      header: t('PLUGIN_IDENTITY_LINKS_ACTION'),
      render: (link) => (
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Misuse}
          iconDescription={t('DELETE')}
          disabled={change.isPending}
          onClick={() =>
            change.mutate(
              { link: { [linkKey]: link.id, type: link.type }, remove: true },
              { onError: (error) => notify({ kind: 'error', title: t(texts.removeFailed), subtitle: error.message }) },
            )
          }
        />
      ),
    },
  ];

  return (
    <Modal open passiveModal modalHeading={t(texts.title)} onRequestClose={onClose}>
      <Stack gap={6}>
        {links.isPending && <SkeletonText paragraph lineCount={2} />}
        {links.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={links.error.message} />}
        {!!links.data?.length && (
          <section>
            <h4 className="cz-modal-section-title">{t(texts.current)}</h4>
            <ListTable
              columns={columns}
              items={links.data.map((link) => ({ ...link, id: link[linkKey]! }))}
              rowKey={(link) => `${link.type}:${link.id}`}
            />
          </section>
        )}
        <form
          className="cz-inline-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (id && !exists) {
              add();
            }
          }}
        >
          <TextInput
            id="cz-identity-link"
            labelText={t(texts.add)}
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            data-modal-primary-focus
          />
          <Button
            kind="primary"
            size="md"
            hasIconOnly
            type="submit"
            renderIcon={Add}
            iconDescription={t(texts.add)}
            disabled={!id || exists || change.isPending}
          />
        </form>
      </Stack>
    </Modal>
  );
}
