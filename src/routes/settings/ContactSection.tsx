import { useId, useState } from 'react';
import { useContact, useProfile, type ContactApi } from '../../account/ProfileProvider';
import type { ContactChoice, ContactTopic, DigestFrequency } from '../../account/types';
import { t } from '../../i18n';

const changedFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Settings → Email preferences (spec 005 US6). Each change saves straight away. */
export function ContactSection() {
  const contact = useContact();
  const [failed, setFailed] = useState(false);
  const save = async (topic: ContactTopic, choice: ContactChoice) =>
    setFailed(!(await contact.set(topic, choice)));

  return (
    <section
      id="contact"
      className="card form-card settings__section"
      aria-labelledby="contact-title"
    >
      <h3 id="contact-title">{t.contact}</h3>
      <p className="hint">{t.contactIntro}</p>
      <ContactBody contact={contact} onSave={(topic, choice) => void save(topic, choice)} />
      {failed && (
        <p role="alert" className="error-text">
          {t.contactFailed}
        </p>
      )}
      <p className="hint">{t.contactAccountEmails}</p>
    </section>
  );
}

type OnSave = (topic: ContactTopic, choice: ContactChoice) => void;

function ContactBody({ contact, onSave }: { contact: ContactApi; onSave: OnSave }) {
  if (contact.status === 'error') {
    return (
      <div role="alert" className="banner">
        <p>{t.contactLoadFailed}</p>
        <button type="button" className="btn btn-primary" onClick={contact.reload}>
          {t.retry}
        </button>
      </div>
    );
  }
  if (contact.status !== 'ready') {
    return (
      <p role="status" className="skeleton skeleton--short">
        {t.pageLoading}
      </p>
    );
  }
  const news = contact.get('product_news');
  const digest = contact.get('nearby_digest');
  const frequency = digest.frequency ?? 'weekly';
  return (
    <ul className="contact-list">
      <Option
        label={t.productNews}
        hint={t.productNewsHint}
        checked={news.optedIn}
        changedAt={news.changedAt}
        onChange={(on) => onSave('product_news', { optedIn: on, frequency: null })}
      />
      <Option
        label={t.nearbyDigest}
        hint={t.nearbyDigestHint}
        checked={digest.optedIn}
        changedAt={digest.changedAt}
        onChange={(on) => onSave('nearby_digest', { optedIn: on, frequency })}
      >
        {digest.optedIn && (
          <DigestDetails
            frequency={frequency}
            onFrequency={(f) => onSave('nearby_digest', { optedIn: true, frequency: f })}
          />
        )}
      </Option>
    </ul>
  );
}

function Option({
  label,
  hint,
  checked,
  changedAt,
  onChange,
  children,
}: {
  label: string;
  hint: string;
  checked: boolean;
  changedAt: string | null;
  onChange: (on: boolean) => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <li className="contact-list__item">
      <label className="check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      <p id={`${id}-hint`} className="hint">
        {hint}
        {changedAt && (
          <span className="contact-list__changed">
            {t.lastChanged(changedFormat.format(new Date(changedAt)))}
          </span>
        )}
      </p>
      {children}
    </li>
  );
}

function DigestDetails({
  frequency,
  onFrequency,
}: {
  frequency: DigestFrequency;
  onFrequency: (f: DigestFrequency) => void;
}) {
  const name = useId();
  const hasHome = Boolean(useProfile().profile?.home);
  const options: [DigestFrequency, string][] = [
    ['weekly', t.weekly],
    ['monthly', t.monthly],
  ];
  return (
    <>
      <fieldset className="contact-list__often">
        <legend>{t.howOften}</legend>
        <div className="chips">
          {options.map(([value, text]) => (
            <label key={value} className="chip">
              <input
                type="radio"
                name={name}
                value={value}
                checked={frequency === value}
                onChange={() => onFrequency(value)}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {!hasHome && (
        <p className="hint">
          {t.needsHome} <a href="#profile">{t.addHome}</a>
        </p>
      )}
    </>
  );
}
