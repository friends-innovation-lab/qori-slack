/**
 * Save content mutations — PATCH Brief/Plan editable content.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractApiError } from '@/api/client';

interface PatchContentResponse {
  canonical_saved: boolean;
  artifact_version: number;
  github_synced: boolean;
  github_sync_error?: string;
  github_url?: string;
  updated_at: string;
}

interface SaveContentInput {
  artifact_version: number;
  sections?: Record<string, string>;
  structured?: Record<string, unknown[]>;
}

export function useSaveBriefContent(studyPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveContentInput) => {
      const res = await api
        .patch(`studies/${studyPublicId}/brief/content`, { json: input })
        .json<{ data: PatchContentResponse }>();
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study', studyPublicId, 'brief'] });
    },
    onError: async (error) => {
      const message = await extractApiError(error);
      throw new Error(message);
    },
  });
}

export function useSavePlanContent(studyPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveContentInput) => {
      const res = await api
        .patch(`studies/${studyPublicId}/plan/content`, { json: input })
        .json<{ data: PatchContentResponse }>();
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study', studyPublicId, 'plan'] });
    },
    onError: async (error) => {
      const message = await extractApiError(error);
      throw new Error(message);
    },
  });
}
