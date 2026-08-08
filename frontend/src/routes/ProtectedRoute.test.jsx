import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: mockUseAuth }));

function renderWithRoute(initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>Secret Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });
    renderWithRoute();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders the protected content when a user is present', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, role: 'SCHOOL_ADMIN' }, isLoading: false });
    renderWithRoute();
    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });

  it('renders nothing while the session is still being restored', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });
    const { container } = renderWithRoute();
    expect(container.textContent).toBe('');
  });
});
