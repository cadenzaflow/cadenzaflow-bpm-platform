import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../i18n';
import { CopyValue } from './CopyValue';

beforeAll(() => initI18n('en'));

describe('CopyValue', () => {
  it('copies the value, not what is shown for it', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(
      <CopyValue text="order:2:28c44e23">
        <a href="/definition">Order</a>
      </CopyValue>,
    );

    expect(screen.getByRole('link', { name: 'Order' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Click to copy 'order:2:28c44e23'" }));
    expect(writeText).toHaveBeenCalledWith('order:2:28c44e23');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
