import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../i18n';
import { CriteriaSearch } from './CriteriaSearch';
import type { Criterion, CriterionType, SearchState } from './criteria';
import { readCriteriaSets } from './saved-criteria';

const types: CriterionType[] = [
  { key: 'name', label: 'Name', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'key', label: 'Key', kind: 'property', operators: ['eq'] },
];
const invoices: Criterion[] = [{ type: 'name', operator: 'Like', value: 'invoice' }];

let criteria: Criterion[] = [];

function Search({ initial }: { initial: Criterion[] }) {
  const [value, setValue] = useState<SearchState>({ criteria: initial, matchAny: false });
  criteria = value.criteria;
  return <CriteriaSearch namespace="common" types={types} value={value} onChange={setValue} allowMatchAny={false} savedGroup="PD" />;
}

beforeAll(() => initI18n('en'));
beforeEach(() => window.localStorage.clear());

describe('saved criteria', () => {
  it('keeps the criteria of a search under a name and brings them back', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Search initial={invoices} />);

    await user.click(screen.getByRole('button', { name: 'Saved criteria' }));
    let dialog = within(screen.getByRole('dialog', { name: 'Saved criteria' }));
    expect(dialog.getByText('No criteria saved yet.')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(dialog.getByLabelText('Save the criteria as'), 'Invoices{Enter}');
    expect(dialog.getByRole('button', { name: 'Invoices' })).toBeInTheDocument();
    expect(readCriteriaSets('PD')).toEqual({ Invoices: invoices });
    // another search has its own sets
    expect(readCriteriaSets('PDI')).toEqual({});
    unmount();

    // a later visit: nothing is searched, the set is there
    render(<Search initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Saved criteria' }));
    dialog = within(screen.getByRole('dialog', { name: 'Saved criteria' }));
    await user.click(dialog.getByRole('button', { name: 'Invoices' }));
    expect(criteria).toEqual(invoices);
    expect(screen.queryByRole('dialog', { name: 'Saved criteria' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Saved criteria' }));
    dialog = within(screen.getByRole('dialog', { name: 'Saved criteria' }));
    await user.click(dialog.getByRole('button', { name: 'Delete Invoices' }));
    expect(dialog.getByText('No criteria saved yet.')).toBeInTheDocument();
    expect(readCriteriaSets('PD')).toEqual({});
  });

  it('has nothing to open without criteria and without sets', () => {
    render(<Search initial={[]} />);
    expect(screen.getByRole('button', { name: 'Saved criteria' })).toBeDisabled();
  });

  it('ignores what it cannot read', () => {
    window.localStorage.setItem('cadenzaflow.search.PD', '{"Broken": "x", "Good": [{"type":"key","operator":"eq","value":"invoice"}]}');
    expect(readCriteriaSets('PD')).toEqual({ Good: [{ type: 'key', operator: 'eq', value: 'invoice', name: undefined }] });
    window.localStorage.setItem('cadenzaflow.search.PD', 'not json');
    expect(readCriteriaSets('PD')).toEqual({});
  });
});
