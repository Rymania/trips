import { useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../account/AuthProvider';
import { useProfile, useSaved, type SavedApi } from '../account/ProfileProvider';
import { orderSaved } from '../account/savedMerge';
import type { SavedTrip } from '../account/types';
import { haversineKm } from '../domain/geo';
import type { Activity, LatLng } from '../domain/types';
import { t } from '../i18n';
import { useActivities } from '../useActivities';
import { Link } from './Link';
import { SignInRequired } from './SignInRequired';

const NOTE_MAX = 500;

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
/** Formats an ISO timestamp, or a plain `YYYY-MM-DD` date as that local day. */
const formatDate = (iso: string) =>
  dateFormat.format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso));

/** Saved trips page (spec 005 US2). */
export default function SavedTrips() {
  const { state } = useAuth();
  if (state.status === 'loading') {
    return (
      <p role="status" className="page skeleton skeleton--short">
        {t.accountLoading}
      </p>
    );
  }
  if (state.status !== 'signedIn') {
    return (
      <SignInRequired
        title={t.savedTrips}
        text={t.savedSignedOut}
        next="/saved"
        disabled={state.status === 'disabled'}
      />
    );
  }
  return <SavedList />;
}

function SavedList() {
  const saved = useSaved();
  const home = useProfile().profile?.home ?? null;
  const { activities, loading } = useActivities();
  const heading = useRef<HTMLHeadingElement>(null);
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const items = useMemo(() => orderSaved(saved.items), [saved.items]);

  return (
    <section className="page saved" aria-labelledby="saved-title">
      <h2 id="saved-title" ref={heading} tabIndex={-1}>
        {t.savedTrips}
      </h2>
      <SavedBody saved={saved} empty={items.length === 0}>
        <ul className="saved-list">
          {items.map((trip) => (
            <SavedItem
              key={trip.activityId}
              trip={trip}
              activity={byId.get(trip.activityId)}
              home={home}
              unavailable={!loading && !byId.has(trip.activityId)}
              onUpdate={saved.update}
              onRemove={saved.remove}
              onRemoved={() => heading.current?.focus()}
            />
          ))}
        </ul>
      </SavedBody>
    </section>
  );
}

function SavedBody({
  saved,
  empty,
  children,
}: {
  saved: SavedApi;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (saved.status === 'error') {
    return (
      <div role="alert" className="banner">
        <p>{t.savedLoadFailed}</p>
        <button type="button" className="btn btn-primary" onClick={saved.reload}>
          {t.retry}
        </button>
      </div>
    );
  }
  if (saved.status !== 'ready') {
    return (
      <p role="status" className="skeleton skeleton--short">
        {t.pageLoading}
      </p>
    );
  }
  if (empty) {
    return (
      <div className="empty">
        <p>{t.savedEmpty}</p>
        <Link className="btn" to="/">
          {t.backToSearch}
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

/** "Saved 1 Oct 2026 · 3.6 km away · Planned for 1 Nov 2026", leaving out what's unknown. */
function tripMeta(trip: SavedTrip, activity: Activity | undefined, home: LatLng | null) {
  return [
    t.savedOn(formatDate(trip.savedAt)),
    home && activity ? t.away(haversineKm(home, activity.location)) : null,
    trip.plannedFor ? t.plannedFor(formatDate(trip.plannedFor)) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

type ItemStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'removeFailed';

function SavedItem({
  trip,
  activity,
  home,
  unavailable,
  onUpdate,
  onRemove,
  onRemoved,
}: {
  trip: SavedTrip;
  activity: Activity | undefined;
  home: LatLng | null;
  unavailable: boolean;
  onUpdate: SavedApi['update'];
  onRemove: SavedApi['remove'];
  onRemoved: () => void;
}) {
  const [status, setStatus] = useState<ItemStatus>('idle');
  const name = activity?.name ?? trip.activityName;
  const img = activity?.images[0];

  const remove = async () => {
    if (await onRemove(trip.activityId)) onRemoved();
    else setStatus('removeFailed');
  };
  const removeButton = (
    <button
      type="button"
      className="btn saved-item__remove"
      aria-label={t.removeSavedNamed(name)}
      onClick={() => void remove()}
    >
      {t.removeSaved}
    </button>
  );

  return (
    <li className="card saved-item">
      {img ? (
        <img src={img.url} alt={img.alt} loading="lazy" width={320} height={180} />
      ) : (
        <div className="card-img" aria-hidden="true">
          {name.charAt(0)}
        </div>
      )}
      <div className="card-body">
        <h3>{name}</h3>
        {unavailable && <p className="tag tag--warn">{t.noLongerAvailable}</p>}
        <p className="meta">{tripMeta(trip, activity, home)}</p>
        {unavailable ? (
          <p className="row">{removeButton}</p>
        ) : (
          <TripForm
            trip={trip}
            status={status}
            onStatus={setStatus}
            onUpdate={onUpdate}
            removeButton={removeButton}
          />
        )}
        {status === 'removeFailed' && (
          <p role="alert" className="error-text">
            {t.removeFailed}
          </p>
        )}
      </div>
    </li>
  );
}

function TripForm({
  trip,
  status,
  onStatus,
  onUpdate,
  removeButton,
}: {
  trip: SavedTrip;
  status: ItemStatus;
  onStatus: (s: ItemStatus) => void;
  onUpdate: SavedApi['update'];
  removeButton: React.ReactNode;
}) {
  const id = useId();
  const [planned, setPlanned] = useState(trip.plannedFor ?? '');
  const [note, setNote] = useState(trip.note ?? '');
  const patch = { plannedFor: planned || null, note: note.trim() || null };
  const dirty = patch.plannedFor !== trip.plannedFor || patch.note !== trip.note;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    onStatus('saving');
    onStatus((await onUpdate(trip.activityId, patch)) ? 'saved' : 'failed');
  };
  const edit = (set: (v: string) => void) => (value: string) => {
    set(value);
    if (status !== 'idle') onStatus('idle');
  };

  return (
    <form className="saved-item__form" onSubmit={(e) => void submit(e)}>
      <div className="saved-item__fields">
        <div className="field">
          <label htmlFor={`${id}-date`}>{t.plannedDate}</label>
          <input
            id={`${id}-date`}
            type="date"
            value={planned}
            onChange={(e) => edit(setPlanned)(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-note`}>{t.note}</label>
          <textarea
            id={`${id}-note`}
            rows={2}
            maxLength={NOTE_MAX}
            value={note}
            aria-describedby={`${id}-count`}
            onChange={(e) => edit(setNote)(e.target.value)}
          />
          <p id={`${id}-count`} className="hint">
            {t.noteCount(note.length)}
          </p>
        </div>
      </div>
      <p className="row">
        <button type="submit" className="btn btn-primary" disabled={!dirty || status === 'saving'}>
          {status === 'saving' ? t.savingChanges : t.saveChanges}
        </button>
        <span role="status" className="form-status">
          {status === 'saved' ? t.changesSaved : ''}
        </span>
        {removeButton}
      </p>
      {status === 'failed' && (
        <p role="alert" className="error-text">
          {t.changesFailed}
        </p>
      )}
    </form>
  );
}
