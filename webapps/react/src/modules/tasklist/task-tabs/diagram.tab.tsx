import { lazy, Suspense } from 'react';
import { SkeletonPlaceholder } from '@carbon/react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { engineUrl, request } from '../../../shared/api/client';
import type { TaskTab, TaskTabProps } from './registry';

const BpmnDiagram = lazy(() => import('../../../shared/diagram/BpmnDiagram'));

/** The task's process with the task highlighted. */
function DiagramTab({ engine, task }: TaskTabProps) {
  const { t } = useTranslation('tasklist');
  const id = task.processDefinitionId;
  const xml = useQuery({
    queryKey: ['process-definition-xml', engine, id],
    staleTime: Infinity,
    queryFn: !id
      ? skipToken
      : async () =>
          (await request<{ bpmn20Xml: string }>(engineUrl(engine, `/process-definition/${encodeURIComponent(id)}/xml`)))
            .bpmn20Xml,
  });

  if (!id || xml.isError) {
    return <p className="cz-tasklist__empty">{t('NO_DIAGRAM')}</p>;
  }
  if (xml.isPending) {
    return <SkeletonPlaceholder className="cz-diagram-skeleton" />;
  }
  return (
    <Suspense fallback={<SkeletonPlaceholder className="cz-diagram-skeleton" />}>
      <BpmnDiagram xml={xml.data} highlight={[task.taskDefinitionKey]} />
    </Suspense>
  );
}

export const tab: TaskTab = {
  id: 'diagram',
  label: 'DIAGRAM',
  order: 30,
  component: DiagramTab,
};
