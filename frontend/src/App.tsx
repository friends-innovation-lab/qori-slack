/**
 * App — Router + providers. All authenticated routes wrapped in AppShell.
 *
 * NAV-1a: Study routes nested under StudyWorkspaceLayout for persistent shell.
 * NAV-1b: Discovery routes are now path-based (/desk, /stakeholders, /surveys).
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/shell/AppShell';
import { StudyWorkspaceLayout } from '@/components/study/workspace';
import { Home } from '@/pages/Home';
import { NewProject } from '@/pages/NewProject';
import { BriefForm } from '@/pages/BriefForm';
import { BriefDocument } from '@/pages/BriefDocument';
import { StudyOverview } from '@/pages/StudyOverview';
import { PlanForm } from '@/pages/PlanForm';
import { PlanDocument } from '@/pages/PlanDocument';
import { Projects } from '@/pages/Projects';
import { ProjectDetail } from '@/pages/ProjectDetail';
import { Login } from '@/pages/Login';
// NAV-1b + DR-4d: Discovery pages with path-based routes
import {
  DiscoveryHub,
  DiscoveryTypePage,
  DeskIntake,
  StakeholderIntake,
  DiscoveryRunPage,
  DeskInsightsPage,
  DeskSourcesPage,
} from '@/pages/discovery';

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
                      {/* NAV-1a: All study routes nested under StudyWorkspaceLayout */}
                      <Route path="studies/:studyPublicId" element={<StudyWorkspaceLayout />}>
                        <Route index element={<StudyOverview />} />
                        <Route path="brief/new" element={<BriefForm />} />
                        <Route path="brief" element={<BriefDocument />} />
                        <Route path="plan/new" element={<PlanForm />} />
                        <Route path="plan" element={<PlanDocument />} />
                        {/* NAV-1b + DR-4d: Discovery routes with path-based navigation */}
                        <Route path="discovery" element={<DiscoveryHub />} />
                        {/* DR-4d: Desk research insight-first pages */}
                        <Route path="discovery/desk" element={<DeskInsightsPage />} />
                        <Route path="discovery/desk/sources" element={<DeskSourcesPage />} />
                        {/* Other discovery types still use run-ledger view */}
                        <Route path="discovery/stakeholders" element={<DiscoveryTypePage />} />
                        <Route path="discovery/surveys" element={<DiscoveryTypePage />} />
                        <Route path="discovery/new/desk" element={<DeskIntake />} />
                        <Route path="discovery/new/stakeholder" element={<StakeholderIntake />} />
                        <Route path="discovery/runs/:runId" element={<DiscoveryRunPage />} />
                        <Route path="discovery/runs/:runId/sources" element={<DiscoveryRunPage />} />
                        <Route path="discovery/runs/:runId/extracted" element={<DiscoveryRunPage />} />
                      </Route>
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
