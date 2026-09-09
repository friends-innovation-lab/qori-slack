import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractApiError } from '@/api/client';
import type { CreateProjectInput, ProjectResource } from '@qori/api-contracts';

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const res = await api
        .post('projects', { json: input })
        .json<{ data: ProjectResource }>();
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
    onError: async (error) => {
      const message = await extractApiError(error);
      throw new Error(message);
    },
  });
}
