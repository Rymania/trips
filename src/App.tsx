import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { AuthProvider } from './account/AuthProvider';
import { AccountMenu } from './components/AccountMenu';
import { ActiveFilters } from './components/ActiveFilters';
import { ActivityDetail } from './components/ActivityDetail';
import { FilterPanel } from './components/FilterPanel';
import { ResultsList } from './components/ResultsList';
import { applyFilters } from './domain/filters';
import type { SortKey, ViewMode } from './domain/types';
import { t } from './i18n';
import { useActivities } from './useActivities';
import { useFilters } from './useFilters';
import { Link } from './routes/Link';
import { useRoute, type RouteName } from './routes/useRoute';

const MapView = lazy(() => import('./components/MapView'));
const pages: Partial<Record<RouteName, React.LazyExoticComponent<() => React.JSX.Element>>> = {
  signIn: lazy(() => import('./routes/SignIn')),
  authCallback: lazy(() => import('./routes/AuthCallback')),
  saved: lazy(() => import('./routes/Placeholder')),
  settings: lazy(() => import('./routes/Placeholder')),
};

const SORTS: [SortKey, string][] = [
  ['distance', t.sortDistance],
  ['cost', t.sortCost],
  ['rating', t.sortRating],
  ['popularity', t.sortPopularity],
  ['name', t.sortName],
];

function loadSaved(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem('saved') ?? '[]') as string[];
  } catch {
    return [];
  }
}

function SearchPage() {
  const [filters, update] = useFilters();
  const { activities, failed, loading, error, reload } = useActivities();
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>(loadSaved);
  const [panelOpen, setPanelOpen] = useState(false);

  const results = useMemo(() => applyFilters(activities, filters), [activities, filters]);
  const open = activities.find((a) => a.id === openId) ?? null;

  const toggleSave = useCallback((id: string) => {
    setSaved((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      try {
        sessionStorage.setItem('saved', JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  const close = useCallback(() => setOpenId(null), []);

  return (
    <>
      <div className="layout">
        <aside className="sidebar">
          <button
            type="button"
            className="btn toggle-filters"
            aria-expanded={panelOpen}
            aria-controls="filter-panel"
            onClick={() => setPanelOpen((o) => !o)}
          >
            {t.filters}
          </button>
          <div id="filter-panel" className={panelOpen ? 'open' : ''}>
            <FilterPanel filters={filters} onChange={update} />
          </div>
        </aside>
        <main id="results" tabIndex={-1}>
          <ActiveFilters filters={filters} onChange={update} />
          <div className="toolbar">
            <p role="status" aria-live="polite">
              {loading ? t.loading : t.results(results.length)}
            </p>
            <div className="seg" role="group" aria-label={t.viewSwitch}>
              {(['list', 'map'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={filters.view === v}
                  onClick={() => update({ view: v })}
                >
                  {v === 'map' ? t.viewMap : t.viewList}
                </button>
              ))}
            </div>
            <label>
              {t.sortBy}{' '}
              <select
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value as SortKey })}
              >
                {SORTS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {failed.length > 0 && !error && (
            <p role="alert" className="banner">
              {t.loadError}
            </p>
          )}
          {error ? (
            <div role="alert" className="banner">
              <p>{t.fatalError}</p>
              <button type="button" className="btn btn-primary" onClick={reload}>
                {t.retry}
              </button>
            </div>
          ) : loading ? (
            <div className="skeleton" aria-hidden="true" />
          ) : filters.view === 'map' ? (
            <Suspense
              fallback={
                <div className="skeleton" role="status">
                  {t.mapLoading}
                </div>
              }
            >
              <MapView results={results} origin={filters.origin} onOpen={setOpenId} />
            </Suspense>
          ) : (
            <ResultsList results={results} familySize={filters.familySize} onOpen={setOpenId} />
          )}
        </main>
      </div>
      {open && (
        <ActivityDetail
          activity={open}
          all={activities}
          filters={filters}
          saved={saved.includes(open.id)}
          onToggleSave={toggleSave}
          onOpen={setOpenId}
          onClose={close}
        />
      )}
    </>
  );
}

/** The page shell: header with the account menu, then the current route. */
function Shell() {
  const route = useRoute();
  const Page = pages[route];
  return (
    <>
      <a className="skip" href={Page ? '#main' : '#results'}>
        {Page ? t.skipToContent : t.skipToResults}
      </a>
      <header className="top">
        <div className="top__brand">
          <h1>
            <Link to="/">{t.appTitle}</Link>
          </h1>
          <p>{t.tagline}</p>
        </div>
        <AccountMenu />
      </header>
      {Page ? (
        <main id="main" tabIndex={-1}>
          <Suspense
            fallback={
              <p role="status" className="page skeleton skeleton--short">
                {t.pageLoading}
              </p>
            }
          >
            <Page />
          </Suspense>
        </main>
      ) : (
        <SearchPage />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
