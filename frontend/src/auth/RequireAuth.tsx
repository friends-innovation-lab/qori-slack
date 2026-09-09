/**
 * Route guard — redirects unauthenticated users to /login.
 * Shows nothing while session check is in progress.
 */

import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { status } = useAuth();

  if (status === 'loading') {
    // Render nothing during initial session check — avoids flash
    return null;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
