import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../../../shared/i18n';
import { toEngineDate } from '../../../shared/variables';
import { DateField } from './DateField';

beforeAll(() => initI18n('en'));

function renderField(value: string | null, onSave = vi.fn(() => Promise.resolve())) {
  render(
    <dl>
      <DateField
        id="due"
        label="Due date"
        value={value}
        setLabel="Set due date"
        resetLabel="Reset due date"
        disabled={false}
        onSave={onSave}
      />
    </dl>,
  );
  return onSave;
}

describe('DateField', () => {
  it('sets a date in the engine format', async () => {
    const onSave = renderField(null);

    await userEvent.click(screen.getByRole('button', { name: 'Set due date' }));
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-25T09:30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(toEngineDate(new Date(2026, 9, 25, 9, 30)));
  });

  it('removes the date', async () => {
    const onSave = renderField(toEngineDate(new Date(2026, 9, 25, 9, 30)));

    await userEvent.click(screen.getByRole('button', { name: 'Reset due date' }));

    expect(onSave).toHaveBeenCalledWith(null);
  });
});
