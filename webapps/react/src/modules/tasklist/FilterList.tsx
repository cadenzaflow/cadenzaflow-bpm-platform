import { useRef, type ReactNode } from 'react';
import { Button, ContainedList, ContainedListItem, InlineNotification, SkeletonText, Tag } from '@carbon/react';
import { Edit } from '@carbon/icons-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { focusFirst, useShortcut } from '../../shared/shortcuts';
import type { TaskFilter } from './api';
import { TASKLIST_SHORTCUTS } from './shortcuts/shortcuts';

interface FilterListProps {
  filters: UseQueryResult<TaskFilter[]>;
  selectedId: string | undefined;
  onSelect: (filterId: string) => void;
  onEdit: (filter: TaskFilter) => void;
  /** Buttons above the filters (start process, ...). */
  actions?: ReactNode;
}

export function FilterList({ filters, selectedId, onSelect, onEdit, actions }: FilterListProps) {
  const { t } = useTranslation('tasklist');
  const section = useRef<HTMLElement>(null);
  useShortcut(TASKLIST_SHORTCUTS.focusFilter.key, () =>
    focusFirst(section.current, '.cds--contained-list-item__content'),
  );

  return (
    <section ref={section} className="cz-tasklist__column cz-tasklist__filters" aria-labelledby="cz-filters-title">
      {actions && <div className="cz-tasklist__actions">{actions}</div>}
      <ContainedList label={<span id="cz-filters-title">{t('FILTERS')}</span>} kind="on-page">
        {filters.isPending && <SkeletonText paragraph lineCount={3} />}
        {filters.isError && (
          <InlineNotification kind="error" lowContrast hideCloseButton subtitle={t('FILTERS_LOADING_FAILURE')} />
        )}
        {filters.data?.length === 0 && <p className="cz-tasklist__empty">{t('NO_FILTERS')}</p>}
        {filters.data?.map((filter) => (
          <ContainedListItem
            key={filter.id}
            className={filter.id === selectedId ? 'cz-list-item--selected' : undefined}
            aria-current={filter.id === selectedId ? 'true' : undefined}
            onClick={() => onSelect(filter.id)}
            action={
              filter.id === selectedId && (
                <Button
                  kind="ghost"
                  size="sm"
                  hasIconOnly
                  renderIcon={Edit}
                  iconDescription={t('FILTER_EDIT')}
                  tooltipPosition="left"
                  onClick={() => onEdit(filter)}
                />
              )
            }
          >
            <span className="cz-filter">
              <span
                className="cz-filter__color"
                style={{ background: filter.properties?.color ?? 'transparent' }}
                aria-hidden="true"
              />
              <span className="cz-filter__name" title={filter.properties?.description}>
                {filter.name}
              </span>
              {filter.itemCount !== undefined && (
                <Tag size="sm" type="cool-gray">
                  {filter.itemCount}
                </Tag>
              )}
            </span>
          </ContainedListItem>
        ))}
      </ContainedList>
    </section>
  );
}
