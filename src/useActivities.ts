import { useCallback, useEffect, useState } from 'react';
import { aggregate } from './data/sources';
import { sampleSource } from './data/sampleSource';
import type { Activity } from './domain/types';

const SOURCES = [sampleSource];

export function useActivities() {
  const [state, setState] = useState<{
    activities: Activity[];
    failed: string[];
    loading: boolean;
    error: boolean;
  }>({
    activities: [],
    failed: [],
    loading: true,
    error: false,
  });

  const fetchAll = useCallback(() => {
    return aggregate(SOURCES)
      .then((r) =>
        setState({
          activities: r.activities,
          failed: r.failedSources,
          loading: false,
          error: r.failedSources.length === SOURCES.length,
        }),
      )
      .catch(() => setState((s) => ({ ...s, loading: false, error: true })));
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: false }));
    void fetchAll();
  }, [fetchAll]);

  return { ...state, reload };
}
