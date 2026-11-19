import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../i18n';
import { CriteriaSearch } from './CriteriaSearch';
import type { Criterion, CriterionType, SearchState } from './criteria';

const types: CriterionType[] = [
  { key: 'createdBy', label: 'Created by', kind: 'property', operators: ['eq'] },
  { key: 'withFailures', label: 'With failures', kind: 'flag', operators: [], group: 'failures' },
  { key: 'withoutFailures', label: 'Without failures', kind: 'flag', operators: [], group: 'failures' },
];

let criteria: Criterion[] = [];

function Search({ initial }: { initial: Criterion[] }) {
  const [value, setValue] = useState<SearchState>({ criteria: initial, matchAny: false });
  criteria = value.criteria;
  return <CriteriaSearch namespace="common" types={types} value={value} onChange={setValue} allowMatchAny={false} />;
}

beforeAll(() => initI18n('en'));

describe('criteria of one group', () => {
  it('take the place of each other', async () => {
    const user = userEvent.setup();
    render(
      <Search
        initial={[
          { type: 'withFailures', operator: 'eq', value: '' },
          { type: 'createdBy', operator: 'eq', value: 'demo' },
          { type: 'createdBy', operator: 'eq', value: '' },
        ]}
      />,
    );

    await user.selectOptions(screen.getAllByRole('combobox')[2], 'Without failures');

    expect(criteria.map((criterion) => criterion.type)).toEqual(['createdBy', 'withoutFailures']);
    expect(criteria[0].value).toBe('demo');
  });
});
