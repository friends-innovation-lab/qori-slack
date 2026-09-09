import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { HomeResource } from '@qori/api-contracts';

export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: async () => {
      const res = await api.get('me/home').json<{ data: HomeResource }>();
      return res.data;
    },
  });
}
