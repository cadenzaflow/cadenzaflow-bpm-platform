import { ContainedList, ContainedListItem, InlineNotification, SkeletonText, Tag } from '@carbon/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TaskFilter } from './api';

interface FilterListProps {
  filters: UseQueryResult<TaskFilter[]>;
  selectedId: string | undefined;
  onSelect: (filterId: string) => void;
}

export function FilterList({ filters, selectedId, onSelect }: FilterListProps) {
  const { t } = useTranslation('tasklist');

  return (
    <section className="cz-tasklist__column cz-tasklist__filters" aria-labelledby="cz-filters-title">
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
          >
            <span className="cz-filter">
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
