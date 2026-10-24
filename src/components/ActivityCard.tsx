import type { ActivityResult } from '../domain/types';
import { estimateFamilyCost, formatCost } from '../domain/filters';
import { t } from '../i18n';

export function dogLabel(d: boolean | 'unknown') {
  return d === true ? `🐕 ${t.dogYes}` : d === false ? `🚫 ${t.dogNo}` : `❔ ${t.dogUnknown}`;
}

export function ageLabel(a: ActivityResult['activity']['ageRange']) {
  return a ? t.agesRange(a.min, a.max) : t.agesUnknown;
}

export function ratingLabel(a: ActivityResult['activity']) {
  return a.rating === null ? t.noRating : `★ ${t.rating(a.rating, a.reviewsCount)}`;
}

interface Props {
  result: ActivityResult;
  familySize: number;
  onOpen: (id: string) => void;
}

export function ActivityCard({ result: { activity: a, distanceKm }, familySize, onOpen }: Props) {
  const family = estimateFamilyCost(a.cost, familySize);
  const img = a.images[0];
  return (
    <li className="card">
      {img ? (
        <img src={img.url} alt={img.alt} loading="lazy" width={320} height={180} />
      ) : (
        <div
          className="card-img"
          role="img"
          aria-label={`${a.categories[0] ?? 'Activity'} placeholder`}
        >
          {a.name[0]}
        </div>
      )}
      <div className="card-body">
        <h3>
          <button type="button" className="card-link" onClick={() => onOpen(a.id)}>
            {a.name}
          </button>
        </h3>
        <p className="meta">
          {t.away(distanceKm)} · {ageLabel(a.ageRange)}
        </p>
        <p className="meta">
          {formatCost(a.cost)}
          {family && a.cost && a.cost.max > 0
            ? ` · ${t.familyCost(`£${family.min.toFixed(0)}–£${family.max.toFixed(0)}`, familySize)}`
            : ''}
        </p>
        <p className="meta">
          {ratingLabel(a)} · {dogLabel(a.dogFriendly)}
        </p>
        <ul className="tags" aria-label="Categories">
          {a.categories.map((c) => (
            <li key={c} className="tag">
              {c}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
