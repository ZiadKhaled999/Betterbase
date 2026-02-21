'use client';

import { useQuery } from '@tanstack/react-query';
import { betterbase } from '@/lib/betterbase';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const result = await betterbase.auth.getUser();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    retry: false,
  });
}
