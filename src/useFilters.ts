import { useCallback, useEffect, useState } from 'react';
import { applyDefaults, filtersToSearch, searchToFilters } from './domain/urlState';
import type { Filters } from './domain/types';

/**
 * Filter state mirrored to the URL query string so searches are shareable.
 * `defaults` (e.g. the home location) fill in whatever the URL leaves unset,
 * including when they arrive after the first render.
 */
export function useFilters(defaults: Partial<Filters> | null = null) {
  const [initialSearch] = useState(() => window.location.search);
  const [filters, setFilters] = useState<Filters>(() => {
    const parsed = searchToFilters(initialSearch);
    return defaults ? applyDefaults(parsed, defaults, initialSearch) : parsed;
  });
  const [applied, setApplied] = useState(defaults);
  if (defaults !== applied) {
    setApplied(defaults);
    if (defaults) setFilters((f) => applyDefaults(f, defaults, initialSearch));
  }

  useEffect(() => {
    const next = filtersToSearch(filters);
    if (next !== window.location.search)
      window.history.replaceState(null, '', `${window.location.pathname}${next}`);
  }, [filters]);

  useEffect(() => {
    const onPop = () => setFilters(searchToFilters(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback(
    (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })),
    [],
  );
  return [filters, update, setFilters] as const;
}
