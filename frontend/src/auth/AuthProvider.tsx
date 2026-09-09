/**
 * Authentication provider — session-based auth via backend cookies.
 *
 * On mount, checks /api/v1/auth/session. If authenticated, fetches /api/v1/me
 * and provides actor/org context to the app. If not, redirects to /login.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api, bootstrapCsrf } from '@/api/client';
import type { MeResource, SessionStatus } from '@qori/api-contracts';

interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  me: MeResource | null;
}

interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    me: null,
  });

  const checkSession = useCallback(async () => {
    try {
      const sessionRes = await api
        .get('auth/session')
        .json<{ data: SessionStatus }>();

      if (!sessionRes.data.authenticated) {
        setState({ status: 'unauthenticated', me: null });
        return;
      }

      // Bootstrap CSRF token for state-changing requests
      await bootstrapCsrf();

      // Fetch full actor profile
      const meRes = await api.get('me').json<{ data: MeResource }>();
      setState({ status: 'authenticated', me: meRes.data });
    } catch {
      setState({ status: 'unauthenticated', me: null });
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const logout = useCallback(async () => {
    try {
      await api.post('auth/logout');
    } catch {
      // Logout failure is non-fatal — clear local state anyway
    }
    setState({ status: 'unauthenticated', me: null });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, logout, refresh: checkSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
