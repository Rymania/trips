import { useEffect, useRef } from 'react';
import { estimateFamilyCost, formatCost } from '../domain/filters';
import { haversineKm } from '../domain/geo';
import type { Activity, Filters } from '../domain/types';
import { t } from '../i18n';
import { ageLabel, dogLabel, ratingLabel } from './ActivityCard';

interface Props {
  activity: Activity;
  all: Activity[];
  filters: Filters;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
}

function safeUrl(u?: string) {
  try {
    const p = new URL(u ?? '');
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : undefined;
  } catch {
    return undefined;
  }
}

export function relatedActivities(a: Activity, all: Activity[], n = 3): Activity[] {
  return all
    .filter((o) => o.id !== a.id && o.categories.some((c) => a.categories.includes(c)))
    .sort((x, y) => haversineKm(a.location, x.location) - haversineKm(a.location, y.location))
    .slice(0, n);
}

export function ActivityDetail({
  activity: a,
  all,
  filters,
  saved,
  onToggleSave,
  onOpen,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    // jsdom lacks showModal; fall back to a plain open dialog.
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);

  const family = estimateFamilyCost(a.cost, filters.familySize);
  const web = safeUrl(a.website);
  const directions = `https://www.openstreetmap.org/directions?to=${a.location.lat}%2C${a.location.lng}`;

  return (
    <dialog
      ref={ref}
      className="detail"
      aria-labelledby="detail-title"
      onClose={onClose}
      onCancel={onClose}
    >
      <header>
        <h2 id="detail-title">{a.name}</h2>
        <button type="button" className="btn" onClick={onClose}>
          {t.close}
        </button>
      </header>
      {a.images.length > 0 && (
        <div className="gallery">
          {a.images.map((i) => (
            <img key={i.url} src={i.url} alt={i.alt} loading="lazy" />
          ))}
        </div>
      )}
      <p>{a.description}</p>
      <dl>
        <dt>{t.address}</dt>
        <dd>{a.address}</dd>
        {a.phone && (
          <>
            <dt>{t.phone}</dt>
            <dd>
              <a href={`tel:${a.phone.replace(/[^+\d]/g, '')}`}>{a.phone}</a>
            </dd>
          </>
        )}
        <dt>{t.hours}</dt>
        <dd>{a.hours ?? t.hoursUnknown}</dd>
        <dt>{t.cost}</dt>
        <dd>
          {formatCost(a.cost)}
          {family && a.cost && a.cost.max > 0
            ? ` · ${t.familyCost(`£${family.min.toFixed(0)}–£${family.max.toFixed(0)}`, filters.familySize)}`
            : ''}
        </dd>
        <dt>{t.ages}</dt>
        <dd>{ageLabel(a.ageRange)}</dd>
        <dt>Dogs</dt>
        <dd>{dogLabel(a.dogFriendly)}</dd>
        <dt>Rating</dt>
        <dd>{ratingLabel(a)}</dd>
        <dt>{t.source}</dt>
        <dd>{a.sourceName}</dd>
      </dl>
      <p className="actions">
        <a className="btn" href={directions} target="_blank" rel="noopener noreferrer">
          {t.directions}
        </a>
        {web && (
          <a className="btn" href={web} target="_blank" rel="noopener noreferrer">
            {t.website}
          </a>
        )}
        <button
          type="button"
          className="btn"
          aria-pressed={saved}
          onClick={() => onToggleSave(a.id)}
        >
          {saved ? `♥ ${t.saved}` : `♡ ${t.save}`}
        </button>
      </p>
      <section aria-labelledby="related-title">
        <h3 id="related-title">{t.related}</h3>
        <ul className="related">
          {relatedActivities(a, all).map((r) => (
            <li key={r.id}>
              <button type="button" className="link" onClick={() => onOpen(r.id)}>
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </dialog>
  );
}
