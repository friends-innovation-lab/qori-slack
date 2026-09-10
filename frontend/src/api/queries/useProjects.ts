import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ProjectResource, StudyResource } from '@qori/api-contracts';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('projects').json<{ data: ProjectResource[] }>();
      return res.data;
    },
  });
}

export function useProject(publicId: string) {
  return useQuery({
    queryKey: ['project', publicId],
    queryFn: async () => {
      const res = await api
        .get(`projects/${publicId}`)
        .json<{ data: ProjectResource }>();
      return res.data;
    },
    enabled: !!publicId,
  });
}

export function useProjectStudies(projectPublicId: string) {
  return useQuery({
    queryKey: ['project', projectPublicId, 'studies'],
    queryFn: async () => {
      const res = await api
        .get(`projects/${projectPublicId}/studies`)
        .json<{ data: StudyResource[] }>();
      return res.data;
    },
    enabled: !!projectPublicId,
  });
}
