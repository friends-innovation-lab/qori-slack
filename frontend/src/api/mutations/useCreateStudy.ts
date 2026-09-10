import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractApiError } from '@/api/client';
import type { CreateStudyInput, StudyResource } from '@qori/api-contracts';

export function useCreateStudy(projectPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateStudyInput) => {
      const res = await api
        .post(`projects/${projectPublicId}/studies`, { json: input })
        .json<{ data: StudyResource }>();
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectPublicId, 'studies'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
    onError: async (error) => {
      const message = await extractApiError(error);
      throw new Error(message);
    },
  });
}
