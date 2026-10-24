import { AGE_GROUPS, type Filters } from '../domain/types';
import { defaultFilters } from '../domain/urlState';
import { t } from '../i18n';

interface Chip {
  key: string;
  label: string;
  clear: Partial<Filters>;
}

function costLabel(f: Filters): string {
  if (f.maxCost === 0) return t.costFree;
  if (f.minCost !== null && f.maxCost !== null) return `£${f.minCost}–£${f.maxCost}`;
  if (f.minCost !== null) return `£${f.minCost}+`;
  return `Up to £${f.maxCost}`;
}

export function activeChips(f: Filters): Chip[] {
  const chips: Chip[] = [];
  if (f.query) chips.push({ key: 'q', label: `“${f.query}”`, clear: { query: '' } });
  f.ageGroups.forEach((g) => {
    const label = AGE_GROUPS.find((a) => a.id === g)?.label ?? g;
    chips.push({
      key: `age-${g}`,
      label: `Ages ${label}`,
      clear: { ageGroups: f.ageGroups.filter((x) => x !== g) },
    });
  });
  if (f.radiusKm !== null)
    chips.push({ key: 'r', label: `${f.radiusKm} km`, clear: { radiusKm: null } });
  if (f.dogFriendly) chips.push({ key: 'dog', label: t.dogYes, clear: { dogFriendly: false } });
  f.categories.forEach((c) =>
    chips.push({
      key: `cat-${c}`,
      label: c,
      clear: { categories: f.categories.filter((x) => x !== c) },
    }),
  );
  if (f.minCost !== null || f.maxCost !== null) {
    chips.push({ key: 'cost', label: costLabel(f), clear: { minCost: null, maxCost: null } });
  }
  return chips;
}

export function ActiveFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (p: Partial<Filters>) => void;
}) {
  const chips = activeChips(filters);
  if (chips.length === 0) return null;
  const d = defaultFilters();
  return (
    <section aria-label={t.activeFilters} className="active-filters">
      <ul>
        {chips.map((c) => (
          <li key={c.key} className="tag">
            {c.label}
            <button
              type="button"
              aria-label={`${t.remove}: ${c.label}`}
              onClick={() => onChange(c.clear)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="link"
        onClick={() =>
          onChange({
            query: '',
            ageGroups: [],
            radiusKm: null,
            dogFriendly: false,
            categories: [],
            minCost: null,
            maxCost: null,
            sort: d.sort,
          })
        }
      >
        {t.clearAll}
      </button>
    </section>
  );
}
