import { useState } from 'react';
import { Checkbox, InlineNotification, Modal, SkeletonText, Stack } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { useDeleteDeployment, useDeploymentInstanceCounts, type DeleteOptions, type Deployment } from './api';

/**
 * Deletes a deployment. With running process or open case instances it can
 * only go together with them (cascade), as in the classic Cockpit; listeners
 * and input/output mappings are skipped by default.
 */
export function DeleteDeploymentModal({ engine, deployment, onClose }: { engine: string; deployment: Deployment; onClose: () => void }) {
  const { t } = useTranslation('cockpit');
  const counts = useDeploymentInstanceCounts(engine, deployment.id);
  const remove = useDeleteDeployment(engine);
  const [options, setOptions] = useState<DeleteOptions>({ cascade: false, skipCustomListeners: true, skipIoMappings: true });
  const processes = counts.data?.processes ?? 0;
  const cases = counts.data?.cases ?? 0;
  const blocked = !options.cascade && processes + cases > 0;

  const info = [
    t('REPOSITORY_DEPLOYMENTS_INFO_THERE_ARE'),
    ...(processes ? [processes.toLocaleString(), t(processes === 1 ? 'REPOSITORY_DEPLOYMENTS_INFO_RUNNING_SINGULAR' : 'REPOSITORY_DEPLOYMENTS_INFO_RUNNING_PLURAL')] : []),
    ...(processes && cases ? [t('REPOSITORY_DEPLOYMENTS_INFO_AND')] : []),
    ...(cases ? [cases.toLocaleString(), t(cases === 1 ? 'REPOSITORY_DEPLOYMENTS_INFO_OPEN_SINGULAR' : 'REPOSITORY_DEPLOYMENTS_INFO_OPEN_PLURAL')] : []),
    t('REPOSITORY_DEPLOYMENTS_INFO_WHICH_BELONG'),
  ].join(' ');

  const option = (key: keyof DeleteOptions, label: string, helper: string) => (
    <Checkbox
      id={`cz-delete-deployment-${key}`}
      labelText={t(label)}
      helperText={t(helper)}
      checked={options[key]}
      onChange={(_, { checked }) => setOptions((previous) => ({ ...previous, [key]: checked }))}
    />
  );

  return (
    <Modal
      open
      danger
      modalHeading={t('REPOSITORY_DEPLOYMENTS_DELETE_TITLE', { deployment: deployment.name || deployment.id })}
      primaryButtonText={t('REPOSITORY_DEPLOYMENTS_DELETE_DELETE')}
      secondaryButtonText={t('REPOSITORY_DEPLOYMENTS_DELETE_CLOSE')}
      primaryButtonDisabled={counts.isPending || blocked || remove.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        remove.mutate(
          { id: deployment.id, options },
          {
            onSuccess: onClose,
            onError: (error) =>
              notify({
                kind: 'error',
                title: t('REPOSITORY_DEPLOYMENTS_INFO_MSN_STATUS'),
                subtitle: t('REPOSITORY_DEPLOYMENTS_INFO_MSN_MSN', { message: error.message }),
              }),
          },
        )
      }
    >
      {counts.isPending ? (
        <Stack gap={4}>
          <p>{t('REPOSITORY_DEPLOYMENTS_DELETE_LOADING')}</p>
          <SkeletonText />
        </Stack>
      ) : (
        <Stack gap={5}>
          <p>{t('REPOSITORY_DEPLOYMENTS_DELETE_THIS_DEPLOYMENT')}</p>
          {processes + cases > 0 && (
            <InlineNotification kind="info" lowContrast hideCloseButton>
              {t('REPOSITORY_DEPLOYMENTS_DELETE_ENABLE_CASCADE', { info })} <code>{t('REPOSITORY_DEPLOYMENTS_DELETE_CASCADE')}</code>{' '}
              {t('REPOSITORY_DEPLOYMENTS_DELETE_FLAG')}
            </InlineNotification>
          )}
          {option('cascade', 'REPOSITORY_DEPLOYMENTS_DELETE_CASCADE', 'REPOSITORY_DEPLOYMENTS_DELETE_CASCADE_TOOLTIP')}
          {option('skipCustomListeners', 'REPOSITORY_DEPLOYMENTS_DELETE_SKIP', 'REPOSITORY_DEPLOYMENTS_DELETE_SKIP_TOOLTIP')}
          {option('skipIoMappings', 'REPOSITORY_DEPLOYMENTS_DELETE_MAPPING', 'REPOSITORY_DEPLOYMENTS_DELETE_MAPPING_TOOLTIP')}
          <p>{t('REPOSITORY_DEPLOYMENTS_DELETE_SURE')}</p>
        </Stack>
      )}
    </Modal>
  );
}
