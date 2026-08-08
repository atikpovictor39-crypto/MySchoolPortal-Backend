import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import PasswordInput from './PasswordInput';

describe('PasswordInput', () => {
  it('masks the value by default', () => {
    render(<PasswordInput aria-label="test password" value="secret" onChange={() => {}} />);
    expect(screen.getByLabelText('test password')).toHaveAttribute('type', 'password');
  });

  it('reveals the value as plain text when the eye is clicked, and re-masks on a second click', async () => {
    render(<PasswordInput aria-label="test password" value="secret" onChange={() => {}} />);
    const input = screen.getByLabelText('test password');
    const toggle = screen.getByRole('button', { name: /show password/i });

    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('keeps the toggle button out of the tab order', () => {
    render(<PasswordInput aria-label="test password" value="secret" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /show password/i })).toHaveAttribute('tabindex', '-1');
  });
});
