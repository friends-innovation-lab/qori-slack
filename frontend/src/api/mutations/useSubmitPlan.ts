import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { SubmitPlanInput } from '@qori/api-contracts';

interface SubmitPlanResult {
  plan_url: string;
}

export function useSubmitPlan(studyPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitPlanInput) => {
      const res = await api
        .post(`studies/${studyPublicId}/plan`, { json: input })
        .json<{ data: SubmitPlanResult }>();
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study', studyPublicId] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
