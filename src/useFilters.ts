import { useCallback, useEffect, useState } from 'react';
import { filtersToSearch, searchToFilters } from './domain/urlState';
import type { Filters } from './domain/types';

/** Filter state mirrored to the URL query string so searches are shareable. */
export function useFilters() {
  const [filters, setFilters] = useState<Filters>(() => searchToFilters(window.location.search));

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
