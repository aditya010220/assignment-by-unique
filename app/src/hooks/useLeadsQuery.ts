import { useState, useEffect, useCallback } from 'react';
import { Lead } from '../types/lead';
import { fetchLeads } from '../services/api';

export interface UseLeadsQueryResult {
  leads: Lead[];
  loading: boolean;
  error: Error | null;
  refetch: (since?: string) => Promise<void>;
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
}

export function useLeadsQuery(): UseLeadsQueryResult {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (since?: string) => {
    try {
      if (!since) {
        setLoading(true);
      }
      setError(null);
      const fetched = await fetchLeads(since);

      setLeads((prev) => {
        if (!since) {
          return fetched;
        }
        // Resync merge: combine existing and new delta leads, deduplicating by id
        const existingIds = new Set(prev.map((l) => l.id));
        const newDelta = fetched.filter((l) => !existingIds.has(l.id));
        const combined = [...newDelta, ...prev];
        return combined.sort(
          (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { leads, loading, error, refetch, setLeads };
}
