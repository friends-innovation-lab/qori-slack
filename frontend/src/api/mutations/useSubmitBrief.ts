import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { SubmitBriefInput } from '@qori/api-contracts';

interface SubmitBriefResult {
  study_public_id: string;
  brief_url: string;
  brief_status: string;
}

export function useSubmitBrief(projectPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitBriefInput) => {
      const res = await api
        .post(`projects/${projectPublicId}/briefs`, { json: input })
        .json<{ data: SubmitBriefResult }>();
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectPublicId] });
      queryClient.invalidateQueries({ queryKey: ['study', data.study_public_id] });
    },
  });
}
