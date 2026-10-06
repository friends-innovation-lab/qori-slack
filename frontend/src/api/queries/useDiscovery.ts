/**
 * Discovery API Hooks — DISC-3
 *
 * React Query hooks for Discovery runs, artifacts, variables, and knowledge gaps.
 * Project-scoped data accessed via study context (study → project mapping).
 */

import { useQuery, type Query } from '@tanstack/react-query';
import { api } from '@/api/client';
import type {
  DiscoveryRunSummary,
  DiscoveryRunDetail,
  DiscoveryArtifactSummary,
  DiscoveryArtifactDetail,
  DiscoveryArtifactVariables,
  DiscoveryKnowledgeGapsResponse,
  DiscoveryTypeKey,
  DiscoveryRunStatus,
} from '@qori/api-contracts';

// ─── Query Keys ────────────────────────────────────────────────────

export const discoveryKeys = {
  all: ['discovery'] as const,
  runs: (projectId: string) => [...discoveryKeys.all, 'runs', projectId] as const,
  runsList: (projectId: string, filters?: { type?: string; status?: string }) =>
    [...discoveryKeys.runs(projectId), 'list', filters] as const,
  run: (projectId: string, runId: string) =>
    [...discoveryKeys.runs(projectId), runId] as const,
  artifacts: (projectId: string) =>
    [...discoveryKeys.all, 'artifacts', projectId] as const,
  artifactsList: (projectId: string, filters?: { type?: string; status?: string }) =>
    [...discoveryKeys.artifacts(projectId), 'list', filters] as const,
  artifact: (projectId: string, artifactId: string) =>
    [...discoveryKeys.artifacts(projectId), artifactId] as const,
  variables: (projectId: string, artifactId: string) =>
    [...discoveryKeys.artifact(projectId, artifactId), 'variables'] as const,
  knowledgeGaps: (projectId: string) =>
    [...discoveryKeys.all, 'knowledge-gaps', projectId] as const,
  counts: (projectId: string) =>
    [...discoveryKeys.all, 'counts', projectId] as const,
};

// ─── Types ─────────────────────────────────────────────────────────

interface DiscoveryRunsFilters {
  type?: DiscoveryTypeKey;
  status?: DiscoveryRunStatus;
  limit?: number;
  offset?: number;
}

interface DiscoveryArtifactsFilters {
  type?: string;
  status?: 'current' | 'superseded' | 'failed';
  limit?: number;
  offset?: number;
}

// ─── Runs ──────────────────────────────────────────────────────────

/**
 * List Discovery runs for a project.
 * DISC-3: Project ID comes from study context (study → project mapping).
 */
export function useDiscoveryRuns(
  projectPublicId: string,
  filters?: DiscoveryRunsFilters,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  return useQuery({
    queryKey: discoveryKeys.runsList(projectPublicId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.offset) params.set('offset', String(filters.offset));

      const query = params.toString();
      const url = `projects/${projectPublicId}/discovery/runs${query ? `?${query}` : ''}`;

      const res = await api.get(url).json<{ data: DiscoveryRunSummary[] }>();
      return res.data;
    },
    enabled: options?.enabled !== false && !!projectPublicId,
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Get Discovery run detail by public ID.
 * DISC-3: Supports function form of refetchInterval for polling based on status.
 */
export function useDiscoveryRun(
  projectPublicId: string,
  runId: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false | ((query: Query<DiscoveryRunDetail>) => number | false);
  },
) {
  return useQuery({
    queryKey: discoveryKeys.run(projectPublicId, runId),
    queryFn: async () => {
      const res = await api
        .get(`projects/${projectPublicId}/discovery/runs/${runId}`)
        .json<{ data: DiscoveryRunDetail }>();
      return res.data;
    },
    enabled: options?.enabled !== false && !!projectPublicId && !!runId,
    refetchInterval: options?.refetchInterval,
  });
}

// ─── Artifacts ─────────────────────────────────────────────────────

/**
 * List Discovery artifacts for a project.
 * Default filter: status=current for Ready artifacts only.
 */
export function useDiscoveryArtifacts(
  projectPublicId: string,
  filters?: DiscoveryArtifactsFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: discoveryKeys.artifactsList(projectPublicId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.offset) params.set('offset', String(filters.offset));

      const query = params.toString();
      const url = `projects/${projectPublicId}/discovery/artifacts${query ? `?${query}` : ''}`;

      const res = await api.get(url).json<{ data: DiscoveryArtifactSummary[] }>();
      return res.data;
    },
    enabled: options?.enabled !== false && !!projectPublicId,
  });
}

/**
 * Get Discovery artifact detail by public ID.
 */
export function useDiscoveryArtifact(
  projectPublicId: string,
  artifactId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: discoveryKeys.artifact(projectPublicId, artifactId),
    queryFn: async () => {
      const res = await api
        .get(`projects/${projectPublicId}/discovery/artifacts/${artifactId}`)
        .json<{ data: DiscoveryArtifactDetail }>();
      return res.data;
    },
    enabled: options?.enabled !== false && !!projectPublicId && !!artifactId,
  });
}

// ─── Variables ─────────────────────────────────────────────────────

/**
 * Get extracted variables for a Discovery artifact.
 * DISC-3B: Queries canonical study_variables via discovery_artifact_fk_id lineage.
 */
export function useArtifactVariables(
  projectPublicId: string,
  artifactId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: discoveryKeys.variables(projectPublicId, artifactId),
    queryFn: async () => {
      const res = await api
        .get(`projects/${projectPublicId}/discovery/artifacts/${artifactId}/variables`)
        .json<{ data: DiscoveryArtifactVariables }>();
      return res.data;
    },
    enabled: options?.enabled !== false && !!projectPublicId && !!artifactId,
  });
}

// ─── Knowledge Gaps ────────────────────────────────────────────────

/**
 * Get aggregated knowledge gaps across all current Discovery artifacts.
 * DISC-3B: Preserves provenance for each gap.
 */
export function useKnowledgeGaps(
  projectPublicId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: discoveryKeys.knowledgeGaps(projectPublicId),
    queryFn: async () => {
      const res = await api
        .get(`projects/${projectPublicId}/discovery/knowledge-gaps`)
        .json<{ data: DiscoveryKnowledgeGapsResponse }>();
      return res.data;
    },
    enabled: options?.enabled !== false && !!projectPublicId,
  });
}

// ─── Discovery Counts (for lifecycle nav) ──────────────────────────

/**
 * DISC-3: Compute discovery counts from artifacts list.
 * This derives counts client-side since the backend doesn't have a dedicated counts endpoint yet.
 */
export function useDiscoveryCounts(
  projectPublicId: string,
  options?: { enabled?: boolean },
) {
  const artifactsQuery = useDiscoveryArtifacts(
    projectPublicId,
    { status: 'current', limit: 100 },
    { enabled: options?.enabled },
  );

  const runsQuery = useDiscoveryRuns(
    projectPublicId,
    { limit: 100 },
    { enabled: options?.enabled },
  );

  // Derive counts from artifacts
  const counts = {
    desk: 0,
    stakeholder: 0,
    survey: 0,
  };

  if (artifactsQuery.data) {
    for (const artifact of artifactsQuery.data) {
      // Map artifact type to filter type
      if (artifact.artifactType === 'desk_research') {
        counts.desk++;
      } else if (artifact.artifactType === 'stakeholder_synthesis') {
        counts.stakeholder++;
      } else if (artifact.artifactType === 'survey_synthesis') {
        counts.survey++;
      }
    }
  }

  // Derive needs-review from runs (failed or processing states that need attention)
  const needsReview = {
    desk: false,
    stakeholder: false,
    survey: false,
  };

  if (runsQuery.data) {
    for (const run of runsQuery.data) {
      // DISC-3: A run needs review if it failed or is in a state requiring researcher action
      const needsAttention = run.status === 'failed';
      if (needsAttention) {
        if (run.discoveryType === 'desk_research') {
          needsReview.desk = true;
        } else if (run.discoveryType === 'stakeholder_synthesis') {
          needsReview.stakeholder = true;
        } else if (run.discoveryType === 'survey_synthesis') {
          needsReview.survey = true;
        }
      }
    }
  }

  return {
    data:
      artifactsQuery.data && runsQuery.data
        ? { ...counts, needsReview }
        : null,
    isLoading: artifactsQuery.isLoading || runsQuery.isLoading,
    error: artifactsQuery.error || runsQuery.error,
  };
}
