import useSWR from 'swr';
import api from '../lib/api';

/**
 * Generic fetcher for SWR using the centralized api instance.
 */
const fetcher = (url: string) => api.get(url).then(res => res.data);

/**
 * Custom hook for data fetching with SWR.
 */
export function useFetch<T>(url: string | null) {
  const { data, error, mutate, isValidating } = useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000, // 10 seconds deduplication
  });

  return {
    data,
    error,
    loading: !error && !data,
    mutate,
    isValidating
  };
}

/**
 * Specialized hook for user matches.
 */
export function useMatches(userId?: string) {
  return useFetch<any[]>(userId ? `/matches/${userId}` : null);
}

/**
 * Specialized hook for places.
 */
export function usePlaces(type?: string, geo?: { lat: number; lng: number }) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (geo) {
    params.set('lat', String(geo.lat));
    params.set('lng', String(geo.lng));
    params.set('radius', '100');
  }
  const query = params.toString();
  return useFetch<any[]>(`/places${query ? `?${query}` : ''}`);
}

/**
 * Specialized hook for events.
 */
export function useEvents() {
  return useFetch<any[]>('/events');
}

/**
 * Specialized hook for goal tree.
 */
export function useGoalTree(userId?: string) {
  return useFetch<any>(userId ? `/goals/${userId}` : null);
}
