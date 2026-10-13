import { useRef } from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useResources } from './api';
import { commonPath } from './search';

interface ResourcesColumnProps {
  engine: string;
  deploymentId: string | undefined;
  selected: string | undefined;
  onSelect: (resourceId: string) => void;
}

/** The files of the selected deployment; arrow keys move the selection. */
export function ResourcesColumn({ engine, deploymentId, selected, onSelect }: ResourcesColumnProps) {
  const { t } = useTranslation('cockpit');
  const resources = useResources(engine, deploymentId);
  const list = useRef<HTMLOListElement>(null);
  const items = resources.data ?? [];
  const shared = commonPath(items.map((resource) => resource.name));

  const move = (step: number) => {
    const index = items.findIndex((resource) => resource.id === selected);
    const next = items[Math.min(items.length - 1, Math.max(0, index + step))];
    if (next) {
      onSelect(next.id);
      list.current?.querySelector<HTMLButtonElement>(`[data-resource-id="${CSS.escape(next.id)}"]`)?.focus();
    }
  };

  return (
    <section className="cz-repository__column cz-repository__resources">
      {deploymentId && resources.isPending && <SkeletonText paragraph lineCount={4} />}
      {resources.isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('REPOSITORY_RESOURCES_FAILURE')}
          subtitle={t('REPOSITORY_RESOURCES_FAILURE_MSN')}
        />
      )}
      {resources.data?.length === 0 && <p className="cz-list-empty">{t('REPOSITORY_RESOURCES_NO_SRC_AVAILABLE')}</p>}
      <ol
        ref={list}
        className="cz-repository__list"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            move(event.key === 'ArrowDown' ? 1 : -1);
          }
        }}
      >
        {items.map((resource) => {
          const path = resource.name.slice(shared.length);
          const slash = path.lastIndexOf('/');
          return (
            <li key={resource.id} className={resource.id === selected ? 'cz-repository__item is-selected' : 'cz-repository__item'}>
              <button
                type="button"
                className="cz-repository__select"
                data-resource-id={resource.id}
                aria-current={resource.id === selected ? 'true' : undefined}
                onClick={() => onSelect(resource.id)}
              >
                {slash >= 0 && <span className="cz-repository__path">{path.slice(0, slash + 1)}</span>}
                <span className="cz-repository__name">{path.slice(slash + 1)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
