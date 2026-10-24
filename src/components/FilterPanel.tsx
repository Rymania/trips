import { useEffect, useId, useState } from 'react';
import { searchPlaces } from '../data/places';
import { AGE_GROUPS, CATEGORIES, type Filters } from '../domain/types';
import { t } from '../i18n';

const RADII = [5, 10, 25, 50];
const COST_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: t.anyCost, min: null, max: null },
  { label: t.costFree, min: null, max: 0 },
  { label: t.costUnder5, min: null, max: 5 },
  { label: t.cost5to15, min: 5, max: 15 },
  { label: t.cost15to30, min: 15, max: 30 },
  { label: t.cost30plus, min: 30, max: null },
];

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

/** Debounces text input so we don't re-filter on every keystroke (300ms per spec). */
function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Local input state that resets whenever the upstream value changes (e.g. "clear all"). */
function useSyncedState(upstream: string) {
  const [value, setValue] = useState(upstream);
  const [prev, setPrev] = useState(upstream);
  if (upstream !== prev) {
    setPrev(upstream);
    setValue(upstream);
  }
  return [value, setValue] as const;
}

export function FilterPanel({ filters, onChange }: Props) {
  const id = useId();
  const [query, setQuery] = useSyncedState(filters.query);
  const [place, setPlace] = useSyncedState(filters.originLabel);
  const [placeError, setPlaceError] = useState('');
  const debouncedQuery = useDebounced(query, 300);
  const suggestions = place !== filters.originLabel ? searchPlaces(place) : [];

  useEffect(() => {
    if (debouncedQuery !== filters.query) onChange({ query: debouncedQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const submitPlace = (text: string) => {
    const hit = searchPlaces(text)[0];
    if (!hit) return setPlaceError(t.locationNotFound);
    setPlaceError('');
    onChange({ origin: hit.location, originLabel: hit.label });
  };

  const locate = () => {
    if (!navigator.geolocation) return setPlaceError(t.locationDenied);
    // Opt-in only: position is used client-side and never sent to a server.
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPlaceError('');
        onChange({
          origin: { lat: p.coords.latitude, lng: p.coords.longitude },
          originLabel: t.yourLocation,
        });
      },
      () => setPlaceError(t.locationDenied),
    );
  };

  const costIdx = COST_PRESETS.findIndex(
    (c) => c.min === filters.minCost && c.max === filters.maxCost,
  );
  const customRadius = filters.radiusKm !== null && !RADII.includes(filters.radiusKm);

  return (
    <form className="filters" onSubmit={(e) => e.preventDefault()} aria-label={t.filters}>
      <div className="field">
        <label htmlFor={`${id}-q`}>{t.searchLabel}</label>
        <input
          id={`${id}-q`}
          type="search"
          maxLength={100}
          value={query}
          placeholder={t.searchPlaceholder}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor={`${id}-loc`}>{t.locationLabel}</label>
        <input
          id={`${id}-loc`}
          type="text"
          list={`${id}-places`}
          value={place}
          maxLength={100}
          placeholder={t.locationPlaceholder}
          aria-describedby={placeError ? `${id}-locerr` : undefined}
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitPlace(place)}
          onBlur={() => place !== filters.originLabel && submitPlace(place)}
        />
        <datalist id={`${id}-places`}>
          {suggestions.map((s) => (
            <option key={s.label} value={s.label} />
          ))}
        </datalist>
        <button type="button" className="link" onClick={locate}>
          {t.useMyLocation}
        </button>
        {placeError && (
          <p id={`${id}-locerr`} role="alert" className="error-text">
            {placeError}
          </p>
        )}
      </div>

      <fieldset>
        <legend>{t.ages}</legend>
        <div className="chips">
          {AGE_GROUPS.map((g) => (
            <label key={g.id} className="chip">
              <input
                type="checkbox"
                checked={filters.ageGroups.includes(g.id)}
                onChange={() => onChange({ ageGroups: toggle(filters.ageGroups, g.id) })}
              />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
        {filters.ageGroups.length === 0 && <p className="hint">{t.agesHint}</p>}
      </fieldset>

      <fieldset>
        <legend>{t.distance}</legend>
        <div className="chips">
          {[null, ...RADII].map((r) => (
            <label key={r ?? 'any'} className="chip">
              <input
                type="radio"
                name={`${id}-radius`}
                checked={filters.radiusKm === r}
                onChange={() => onChange({ radiusKm: r })}
              />
              <span>{r === null ? t.anyDistance : `${r} km`}</span>
            </label>
          ))}
        </div>
        <label htmlFor={`${id}-custom`} className="sub">
          {t.customRadius}
        </label>
        <input
          id={`${id}-custom`}
          type="number"
          min={1}
          max={500}
          inputMode="decimal"
          value={customRadius ? (filters.radiusKm ?? '') : ''}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ radiusKm: e.target.value !== '' && n > 0 ? Math.min(n, 500) : null });
          }}
        />
      </fieldset>

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            role="switch"
            checked={filters.dogFriendly}
            onChange={(e) => onChange({ dogFriendly: e.target.checked })}
          />
          <span>{t.dogFriendly}</span>
        </label>
      </div>

      <fieldset>
        <legend>{t.categories}</legend>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <label key={c} className="chip">
              <input
                type="checkbox"
                checked={filters.categories.includes(c)}
                onChange={() => onChange({ categories: toggle(filters.categories, c) })}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t.cost}</legend>
        <div className="chips">
          {COST_PRESETS.map((c, i) => (
            <label key={c.label} className="chip">
              <input
                type="radio"
                name={`${id}-cost`}
                checked={costIdx === i}
                onChange={() => onChange({ minCost: c.min, maxCost: c.max })}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <div className="row">
          <label className="sub">
            Min £
            <input
              type="number"
              min={0}
              value={filters.minCost ?? ''}
              onChange={(e) =>
                onChange({
                  minCost: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                })
              }
            />
          </label>
          <label className="sub">
            Max £
            <input
              type="number"
              min={0}
              value={filters.maxCost ?? ''}
              onChange={(e) =>
                onChange({
                  maxCost: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                })
              }
            />
          </label>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor={`${id}-fam`}>{t.familySize}</label>
        <input
          id={`${id}-fam`}
          type="number"
          min={1}
          max={20}
          value={filters.familySize}
          onChange={(e) =>
            onChange({ familySize: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })
          }
        />
      </div>
    </form>
  );
}
