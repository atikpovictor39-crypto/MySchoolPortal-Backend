import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LoginPage from './LoginPage';

const { mockLogin } = vi.hoisted(() => ({ mockLogin: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));

beforeEach(() => {
  mockLogin.mockReset();
});

describe('LoginPage', () => {
  it('submits the entered credentials', async () => {
    mockLogin.mockResolvedValue({ role: 'SCHOOL_ADMIN' });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'admin@school.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('admin@school.com', 'password123'));
  });

  it('shows the server error message when login fails', async () => {
    mockLogin.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'wrong@school.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolveLogin;
    mockLogin.mockReturnValue(new Promise((resolve) => { resolveLogin = resolve; }));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'admin@school.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    resolveLogin({ role: 'SCHOOL_ADMIN' });
  });
});
