/**
 * App — Router + providers. All authenticated routes wrapped in AppShell.
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/shell/AppShell';
import { Home } from '@/pages/Home';
import { NewProject } from '@/pages/NewProject';
import { BriefForm } from '@/pages/BriefForm';
import { BriefDetail } from '@/pages/BriefDetail';
import { StudyOverview } from '@/pages/StudyOverview';
import { PlanForm } from '@/pages/PlanForm';
import { PlanDetail } from '@/pages/PlanDetail';
import { Projects } from '@/pages/Projects';
import { ProjectDetail } from '@/pages/ProjectDetail';
import { Login } from '@/pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<RequireAuth />}>
              <Route
                element={
                  <AppShell>
                    <Routes>
                      <Route index element={<Home />} />
                      <Route path="projects" element={<Projects />} />
                      <Route path="projects/new" element={<NewProject />} />
                      <Route path="projects/:projectPublicId" element={<ProjectDetail />} />
                      <Route path="studies/:studyPublicId/brief/new" element={<BriefForm />} />
                      <Route path="studies/:studyPublicId/brief" element={<BriefDetail />} />
                      <Route path="studies/:studyPublicId" element={<StudyOverview />} />
                      <Route path="studies/:studyPublicId/plan/new" element={<PlanForm />} />
                      <Route path="studies/:studyPublicId/plan" element={<PlanDetail />} />
                      <Route path="*" element={<Home />} />
                    </Routes>
                  </AppShell>
                }
                path="*"
              />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
