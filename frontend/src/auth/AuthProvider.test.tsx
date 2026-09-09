/**
 * WS-1: AuthProvider + RequireAuth tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { AuthProvider, useAuth } from './AuthProvider';
import { RequireAuth } from './RequireAuth';
import { Routes, Route } from 'react-router';

// Mock the api client module
vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  bootstrapCsrf: vi.fn().mockResolvedValue(undefined),
}));

import { api } from '@/api/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMock = api.get as any;

function AuthStatus() {
  const { status, me } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      {me && <span data-testid="name">{me.actor.display_name}</span>}
    </div>
  );
}

function ProtectedPage() {
  return <div data-testid="protected">Protected content</div>;
}

function LoginPage() {
  return <div data-testid="login">Login page</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows authenticated state when session is valid', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === 'auth/session') {
        return { json: () => Promise.resolve({ data: { authenticated: true } }) } as any;
      }
      if (url === 'me') {
        return {
          json: () => Promise.resolve({
            data: {
              actor: { public_id: 'a1', display_name: 'Alex' },
              organization: { public_id: 'o1', slug: 'org', name: 'Org' },
              authentication_provider: 'session',
              memberships: [],
            },
          }),
        } as any;
      }
      return { json: () => Promise.reject(new Error('unknown')) } as any;
    });

    renderWithProviders(
      <AuthProvider>
        <AuthStatus />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });
    expect(screen.getByTestId('name')).toHaveTextContent('Alex');
  });

  it('shows unauthenticated state when session check fails', async () => {
    getMock.mockImplementation(() => {
      return { json: () => Promise.resolve({ data: { authenticated: false } }) } as any;
    });

    renderWithProviders(
      <AuthProvider>
        <AuthStatus />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
  });

  it('shows unauthenticated on network error', async () => {
    getMock.mockImplementation(() => {
      return { json: () => Promise.reject(new Error('Network error')) } as any;
    });

    renderWithProviders(
      <AuthProvider>
        <AuthStatus />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
  });
});

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when unauthenticated', async () => {
    getMock.mockImplementation(() => {
      return { json: () => Promise.resolve({ data: { authenticated: false } }) } as any;
    });

    renderWithProviders(
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<ProtectedPage />} />
          </Route>
        </Routes>
      </AuthProvider>,
      { initialEntries: ['/'] },
    );

    await waitFor(() => {
      expect(screen.getByTestId('login')).toBeInTheDocument();
    });
  });

  it('renders protected content when authenticated', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === 'auth/session') {
        return { json: () => Promise.resolve({ data: { authenticated: true } }) } as any;
      }
      if (url === 'me') {
        return {
          json: () => Promise.resolve({
            data: {
              actor: { public_id: 'a1', display_name: 'Alex' },
              organization: { public_id: 'o1', slug: 'org', name: 'Org' },
              authentication_provider: 'session',
              memberships: [],
            },
          }),
        } as any;
      }
      return { json: () => Promise.reject(new Error('unknown')) } as any;
    });

    renderWithProviders(
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<ProtectedPage />} />
          </Route>
        </Routes>
      </AuthProvider>,
      { initialEntries: ['/'] },
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected')).toBeInTheDocument();
    });
  });
});
