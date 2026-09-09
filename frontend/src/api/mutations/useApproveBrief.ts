import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ApproveBriefInput, RequestChangesInput } from '@qori/api-contracts';

export function useApproveBrief(studyPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApproveBriefInput) => {
      const res = await api
        .post(`studies/${studyPublicId}/brief/approve`, { json: input })
        .json<{ data: { new_status: string } }>();
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study', studyPublicId] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useRequestChanges(studyPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RequestChangesInput) => {
      const res = await api
        .post(`studies/${studyPublicId}/brief/request-changes`, { json: input })
        .json<{ data: { new_status: string } }>();
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study', studyPublicId] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
