import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth, type AuthFailure } from '../../account/AuthProvider';
import { useProfile } from '../../account/ProfileProvider';
import type { Home, Profile } from '../../account/types';
import { searchPlaces } from '../../data/places';
import { t } from '../../i18n';
import { EMAIL } from '../email';

const NAME_MAX = 50;

/**
 * The typed home location as a Home: null when empty, the saved one when
 * unchanged, otherwise the first gazetteer match (undefined if none).
 */
function resolveHome(text: string, current: Home | null): Home | null | undefined {
  const value = text.trim();
  if (!value) return null;
  if (current && value === current.name) return current;
  const hit = searchPlaces(value)[0];
  return hit && { name: hit.label, lat: hit.location.lat, lng: hit.location.lng };
}

/** Settings → Profile: display name, home location and sign-in email (spec 005 US4). */
export function ProfileSection() {
  const { status, profile, reload } = useProfile();
  return (
    <section
      id="profile"
      className="card form-card settings__section"
      aria-labelledby="profile-title"
    >
      <h3 id="profile-title">{t.profile}</h3>
      {status === 'error' ? (
        <div role="alert" className="banner">
          <p>{t.profileLoadFailed}</p>
          <button type="button" className="btn btn-primary" onClick={reload}>
            {t.retry}
          </button>
        </div>
      ) : profile ? (
        <>
          <DetailsForm key={profile.id} profile={profile} />
          <EmailForm />
        </>
      ) : (
        <p role="status" className="skeleton skeleton--short">
          {t.pageLoading}
        </p>
      )}
    </section>
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/** Checks the details form, returning which fields are wrong and, if none, what to save. */
function validateDetails(name: string, place: string, current: Home | null) {
  const displayName = name.trim();
  const length = [...displayName].length; // code points, as Postgres counts them
  const home = resolveHome(place, current);
  const errors = { name: length < 1 || length > NAME_MAX, place: home === undefined };
  const patch = errors.name || home === undefined ? null : { displayName, home };
  return { errors, patch };
}

function DetailsForm({ profile }: { profile: Profile }) {
  const { save } = useProfile();
  const id = useId();
  const [name, setName] = useState(profile.displayName ?? '');
  const [place, setPlace] = useState(profile.home?.name ?? '');
  const [errors, setErrors] = useState({ name: false, place: false });
  const [status, setStatus] = useState<SaveStatus>('idle');
  const suggestions = place && place !== profile.home?.name ? searchPlaces(place) : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { errors: next, patch } = validateDetails(name, place, profile.home);
    setErrors(next);
    if (!patch) return;
    setPlace(patch.home?.name ?? '');
    setStatus('saving');
    setStatus((await save(patch)) ? 'saved' : 'failed');
  };

  return (
    <form
      aria-label={t.yourDetails}
      className="settings__form"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <Field
        id={`${id}-name`}
        label={t.displayName}
        hint={t.displayNameHint}
        error={errors.name ? t.displayNameInvalid : null}
      >
        {(describedBy) => (
          <input
            id={`${id}-name`}
            type="text"
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name}
            aria-describedby={describedBy}
          />
        )}
      </Field>
      <Field
        id={`${id}-home`}
        label={t.homeLocation}
        hint={t.homeLocationHint}
        error={errors.place ? t.locationNotFound : null}
      >
        {(describedBy) => (
          <>
            <input
              id={`${id}-home`}
              type="text"
              autoComplete="off"
              list={`${id}-places`}
              placeholder={t.locationPlaceholder}
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              aria-invalid={errors.place}
              aria-describedby={describedBy}
            />
            <datalist id={`${id}-places`}>
              {suggestions.map((s) => (
                <option key={s.label} value={s.label} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <SaveRow status={status} />
    </form>
  );
}

function SaveRow({ status }: { status: SaveStatus }) {
  return (
    <>
      <p className="row">
        <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
          {status === 'saving' ? t.savingChanges : t.saveDetails}
        </button>
        <span role="status" className="form-status">
          {status === 'saved' ? t.detailsSaved : ''}
        </span>
      </p>
      {status === 'failed' && (
        <p role="alert" className="error-text">
          {t.detailsFailed}
        </p>
      )}
    </>
  );
}

/** A labelled field with a hint, replaced by the error message when there is one. */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
  children: (describedBy: string | undefined) => React.ReactNode;
}) {
  const message = error ?? hint;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(message ? `${id}-msg` : undefined)}
      {message && (
        <p id={`${id}-msg`} className={error ? 'error-text' : 'hint'}>
          {message}
        </p>
      )}
    </div>
  );
}

const emailFailure: Record<AuthFailure, string> = {
  expired: t.emailChangeFailed,
  failed: t.emailChangeFailed,
  rateLimited: t.rateLimited,
  unavailable: t.accountsUnavailable,
};

function EmailForm() {
  const { state } = useAuth();
  const { changeEmail } = useProfile();
  const id = useId();
  const current = state.status === 'signedIn' ? state.user.email : '';
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    const problem = !EMAIL.test(value)
      ? t.emailInvalid
      : value === current.toLowerCase()
        ? t.emailUnchanged
        : null;
    setInvalid(problem);
    setFailure(null);
    setSentTo(null);
    if (problem) return;
    setBusy(true);
    const res = await changeEmail(value);
    setBusy(false);
    if (!res.ok) return setFailure(res.reason);
    setSentTo(value);
    setEmail('');
  };

  return (
    <form
      aria-label={t.signInEmail}
      className="settings__form"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <p>
        {t.currentEmail} <strong>{current}</strong>
      </p>
      <Field id={`${id}-email`} label={t.newEmail} error={invalid}>
        {(describedBy) => (
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={invalid !== null}
            aria-describedby={describedBy}
          />
        )}
      </Field>
      <p className="row">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? t.sending : t.changeEmail}
        </button>
      </p>
      <p role="status" className="form-status">
        {sentTo ? t.emailChangeSent(sentTo, current) : ''}
      </p>
      {failure && (
        <p role="alert" className="banner">
          {emailFailure[failure]}
        </p>
      )}
    </form>
  );
}
