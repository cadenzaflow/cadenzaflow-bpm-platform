import { useState } from 'react';
import { Button, Modal, TextArea } from '@carbon/react';
import { AddComment } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { useAddComment } from './api';

/** "Add comment" and its dialog; comments show up in the history tab. */
export function CommentButton({ engine, taskId }: { engine: string; taskId: string }) {
  const { t } = useTranslation('tasklist');
  const addComment = useAddComment(engine, taskId);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const close = () => {
    setOpen(false);
    setMessage('');
  };

  return (
    <>
      <Button kind="ghost" size="sm" renderIcon={AddComment} onClick={() => setOpen(true)}>
        {t('COMMENT_CREATE')}
      </Button>
      {open && (
        <Modal
          open
          modalHeading={t('COMMENT_CREATE')}
          primaryButtonText={t('SAVE')}
          secondaryButtonText={t('CANCEL')}
          primaryButtonDisabled={!message.trim() || addComment.isPending}
          onRequestClose={close}
          onRequestSubmit={() =>
            addComment.mutate(message.trim(), {
              onSuccess: close,
              onError: (error) => notify({ kind: 'error', title: t('COMMENT_SAVE_ERROR'), subtitle: error.message }),
            })
          }
        >
          <TextArea
            id="cz-comment"
            labelText={t('COMMENT')}
            placeholder={t('COMMENT_MESSAGE_PLACEHOLDER')}
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Modal>
      )}
    </>
  );
}
