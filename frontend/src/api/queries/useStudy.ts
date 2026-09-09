import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { StudyResource, StudyBriefResource, StudyPlanResource, CascadeReadiness } from '@qori/api-contracts';

export function useStudy(publicId: string) {
  return useQuery({
    queryKey: ['study', publicId],
    queryFn: async () => {
      const res = await api
        .get(`studies/${publicId}`)
        .json<{ data: StudyResource }>();
      return res.data;
    },
    enabled: !!publicId,
  });
}

export function useStudyBrief(studyPublicId: string) {
  return useQuery({
    queryKey: ['study', studyPublicId, 'brief'],
    queryFn: async () => {
      const res = await api
        .get(`studies/${studyPublicId}/brief`)
        .json<{ data: StudyBriefResource }>();
      return res.data;
    },
    enabled: !!studyPublicId,
  });
}

export function useStudyPlan(studyPublicId: string) {
  return useQuery({
    queryKey: ['study', studyPublicId, 'plan'],
    queryFn: async () => {
      const res = await api
        .get(`studies/${studyPublicId}/plan`)
        .json<{ data: StudyPlanResource }>();
      return res.data;
    },
    enabled: !!studyPublicId,
  });
}

export function useCascadeReadiness(studyPublicId: string) {
  return useQuery({
    queryKey: ['study', studyPublicId, 'cascade-readiness'],
    queryFn: async () => {
      const res = await api
        .get(`studies/${studyPublicId}/cascade-readiness`)
        .json<{ data: CascadeReadiness }>();
      return res.data;
    },
    enabled: !!studyPublicId,
  });
}
