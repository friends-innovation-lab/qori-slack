/**
 * Create Discovery Run Mutation — DISC-3
 *
 * Creates a new Discovery run (desk_research or stakeholder_synthesis).
 * Returns pending run immediately. Worker processes asynchronously.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { discoveryKeys } from '@/api/queries/useDiscovery';
import type {
  DiscoveryRunSummary,
  CreateDiscoveryRunInput,
} from '@qori/api-contracts';

interface CreateDiscoveryRunResponse {
  data: DiscoveryRunSummary;
  meta: {
    message: string;
    pollUrl: string;
    recommendedPollInterval: string;
  };
}

/**
 * Create a new Discovery run.
 *
 * @param projectPublicId - Project public ID
 */
export function useCreateDiscoveryRun(projectPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDiscoveryRunInput) => {
      const res = await api
        .post(`projects/${projectPublicId}/discovery/runs`, {
          json: input,
        })
        .json<CreateDiscoveryRunResponse>();
      return res;
    },
    onSuccess: () => {
      // Invalidate runs list to show the new pending run
      queryClient.invalidateQueries({
        queryKey: discoveryKeys.runs(projectPublicId),
      });
    },
  });
}
