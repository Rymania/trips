import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './account/AuthProvider';
import { ProfileProvider, useFamily, useProfile, useSaved } from './account/ProfileProvider';
import { AccountMenu } from './components/AccountMenu';
import { ActiveFilters } from './components/ActiveFilters';
import { ActivityDetail } from './components/ActivityDetail';
import { FilterPanel } from './components/FilterPanel';
import { ResultsList } from './components/ResultsList';
import { familyDefaults } from './domain/family';
import { applyFilters } from './domain/filters';
import type { Activity, Filters, SortKey, ViewMode } from './domain/types';
import { t } from './i18n';
import { useActivities } from './useActivities';
import { useFilters } from './useFilters';
import { Link } from './routes/Link';
import { useRoute, type RouteName } from './routes/useRoute';

const MapView = lazy(() => import('./components/MapView'));
const pages: Partial<Record<RouteName, React.LazyExoticComponent<() => React.JSX.Element>>> = {
  signIn: lazy(() => import('./routes/SignIn')),
  authCallback: lazy(() => import('./routes/AuthCallback')),
  saved: lazy(() => import('./routes/SavedTrips')),
  settings: lazy(() => import('./routes/settings/Settings')),
};

const SORTS: [SortKey, string][] = [
  ['distance', t.sortDistance],
  ['cost', t.sortCost],
  ['rating', t.sortRating],
  ['popularity', t.sortPopularity],
  ['name', t.sortName],
];

/**
 * Per-user search defaults: start from home when the URL has no location, and
 * with the family's ages, size and dog when the URL has no filters.
 */
function useSearchDefaults(): Partial<Filters> | null {
  const home = useProfile().profile?.home;
  const { members } = useFamily();
  const { name, lat, lng } = home ?? {};
  return useMemo(() => {
    const defaults: Partial<Filters> = familyDefaults(members, new Date());
    if (name !== undefined && lat !== undefined && lng !== undefined) {
      defaults.origin = { lat, lng };
      defaults.originLabel = name;
    }
    return Object.keys(defaults).length > 0 ? defaults : null;
  }, [members, name, lat, lng]);
}

function SearchPage() {
  const [filters, update] = useFilters(useSearchDefaults());
  const { activities, failed, loading, error, reload } = useActivities();
  const [openId, setOpenId] = useState<string | null>(null);
  const { state } = useAuth();
  const saved = useSaved();
  const [saveFailed, setSaveFailed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const results = useMemo(() => applyFilters(activities, filters), [activities, filters]);
  const open = activities.find((a) => a.id === openId) ?? null;

  const { toggle } = saved;
  const toggleSave = useCallback(
    async (a: Activity) => setSaveFailed(!(await toggle({ id: a.id, name: a.name }))),
    [toggle],
  );
  const openActivity = useCallback((id: string | null) => {
    setSaveFailed(false);
    setOpenId(id);
  }, []);
  const close = useCallback(() => openActivity(null), [openActivity]);

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
              <MapView results={results} origin={filters.origin} onOpen={openActivity} />
            </Suspense>
          ) : (
            <ResultsList results={results} familySize={filters.familySize} onOpen={openActivity} />
          )}
        </main>
      </div>
      {open && (
        <ActivityDetail
          activity={open}
          all={activities}
          filters={filters}
          saved={saved.isSaved(open.id)}
          offerSignIn={state.status === 'anonymous'}
          saveFailed={saveFailed}
          onToggleSave={(a) => void toggleSave(a)}
          onOpen={openActivity}
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
      <ProfileProvider>
        <Shell />
      </ProfileProvider>
    </AuthProvider>
  );
}
