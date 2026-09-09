import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { MeResource } from '@qori/api-contracts';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('me').json<{ data: MeResource }>();
      return res.data;
    },
  });
}
