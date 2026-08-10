import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
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
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
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
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    resolveLogin({ role: 'SCHOOL_ADMIN' });
  });

  // Regression test: logging out from a SuperAdmin-only page (say /schools)
  // leaves that path in location.state.from — logging back in as a
  // different role must not honor it, or that role lands on a page built
  // for someone else (see AppShell's matching allowedPaths safety net).
  it('ignores a leftover redirect target meant for a different role', async () => {
    mockLogin.mockResolvedValue({ role: 'SCHOOL_ADMIN' });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/schools' } } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route path="/schools" element={<div>Schools Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'admin@school.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Schools Page')).not.toBeInTheDocument();
  });

  it('honors a leftover redirect target that IS valid for the logged-in role', async () => {
    mockLogin.mockResolvedValue({ role: 'SCHOOL_ADMIN' });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/dashboard' } } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'admin@school.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
  });
});
