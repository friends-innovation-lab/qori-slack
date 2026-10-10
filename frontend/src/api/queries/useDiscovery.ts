/**
 * Discovery API Hooks — DISC-3 + DR-4d
 *
 * React Query hooks for Discovery runs, artifacts, variables, and knowledge gaps.
 * Project-scoped data accessed via study context (study → project mapping).
 *
 * DR-4d: Integrated insight needs-review count into useDiscoveryCounts.
 */

import { useQuery, type Query } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useNeedsReviewCount } from '@/api/insights';
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
 * DISC-3: Compute discovery counts from artifacts list with exactness guarantee.
 *
 * API contract: GET /discovery/artifacts returns { data: artifacts[] } with no total metadata.
 * Backend limit: default 50, max 100.
 *
 * Exactness rule: We can only prove count is exact if returned items < requested limit.
 * If items === limit, there may be more items, so count is unknown.
 *
 * Design fallback: When count exactness cannot be proven, return null (omit count).
 * Never display page.length as a definitive project-wide count when API may truncate.
 */
const ARTIFACTS_QUERY_LIMIT = 100; // Max allowed by backend

export function useDiscoveryCounts(
  projectPublicId: string,
  options?: { enabled?: boolean },
) {
  const artifactsQuery = useDiscoveryArtifacts(
    projectPublicId,
    { status: 'current', limit: ARTIFACTS_QUERY_LIMIT },
    { enabled: options?.enabled },
  );

  const runsQuery = useDiscoveryRuns(
    projectPublicId,
    { limit: ARTIFACTS_QUERY_LIMIT },
    { enabled: options?.enabled },
  );

  // DR-4d: Fetch insight needs-review count for desk research badge
  const insightReviewQuery = useNeedsReviewCount(projectPublicId);

  // DISC-3 exactness: If we received exactly the limit, count may be truncated
  const artifactsExact = artifactsQuery.data
    ? artifactsQuery.data.length < ARTIFACTS_QUERY_LIMIT
    : false;

  // Derive counts from artifacts (only if exactness can be proven)
  const counts: {
    desk: number | null;
    stakeholder: number | null;
    survey: number | null;
  } = {
    desk: null,
    stakeholder: null,
    survey: null,
  };

  if (artifactsQuery.data && artifactsExact) {
    // Count is exact — safe to display
    let deskCount = 0;
    let stakeholderCount = 0;
    let surveyCount = 0;

    for (const artifact of artifactsQuery.data) {
      if (artifact.artifactType === 'desk_research') {
        deskCount++;
      } else if (artifact.artifactType === 'stakeholder_synthesis') {
        stakeholderCount++;
      } else if (artifact.artifactType === 'survey_synthesis') {
        surveyCount++;
      }
    }

    counts.desk = deskCount;
    counts.stakeholder = stakeholderCount;
    counts.survey = surveyCount;
  }
  // If !artifactsExact, counts remain null (omitted per design fallback)

  // Derive needs-review from runs (failed states that need attention)
  // Note: needs-review is boolean, not a count, so truncation doesn't matter
  // as long as we see at least one failed run of that type
  const needsReview = {
    desk: false,
    stakeholder: false,
    survey: false,
  };

  if (runsQuery.data) {
    for (const run of runsQuery.data) {
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

  // DR-4d: Desk research also needs review if insights need review
  // Per SPEC-2 §5: "Use the backend count endpoint as authority"
  if (insightReviewQuery.data && insightReviewQuery.data > 0) {
    needsReview.desk = true;
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
