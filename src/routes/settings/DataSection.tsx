import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../account/AuthProvider';
import { useProfile } from '../../account/ProfileProvider';
import { t } from '../../i18n';
import { showNotice } from '../notice';
import { navigate } from '../useRoute';

/** Saves `data` as a JSON file through a temporary link. */
function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Settings → Your data: download it, or delete the account (spec 005 US7, UK GDPR). */
export function DataSection() {
  return (
    <section id="data" className="card form-card settings__section" aria-labelledby="data-title">
      <h3 id="data-title">{t.yourData}</h3>
      <Download />
      <Delete />
    </section>
  );
}

function Download() {
  const { exportData } = useProfile();
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed'>('idle');
  const download = async () => {
    setStatus('busy');
    const res = await exportData();
    if (res.ok) downloadJson(res.data, `family-day-planner-data-${today()}.json`);
    setStatus(res.ok ? 'idle' : 'failed');
  };
  return (
    <div className="settings__form">
      <p>{t.downloadIntro}</p>
      <p className="row">
        <button
          type="button"
          className="btn"
          disabled={status === 'busy'}
          onClick={() => void download()}
        >
          {status === 'busy' ? t.preparingDownload : t.downloadData}
        </button>
      </p>
      {status === 'failed' && (
        <p role="alert" className="error-text">
          {t.downloadFailed}
        </p>
      )}
    </div>
  );
}

function Delete() {
  const [open, setOpen] = useState(false);
  const start = useRef<HTMLButtonElement>(null);
  const reopened = useRef(false);

  // Return focus to the button that opened the form once it closes.
  useEffect(() => {
    if (!open && reopened.current) start.current?.focus();
  }, [open]);

  return (
    <div className="settings__form danger-zone">
      <h4 className="settings__subhead">{t.deleteTitle}</h4>
      <p>{t.deleteIntro}</p>
      {open ? (
        <DeleteForm
          onCancel={() => {
            reopened.current = true;
            setOpen(false);
          }}
        />
      ) : (
        <p className="row">
          <button
            ref={start}
            type="button"
            className="btn btn-danger"
            onClick={() => setOpen(true)}
          >
            {t.deleteStart}
          </button>
        </p>
      )}
    </div>
  );
}

function DeleteForm({ onCancel }: { onCancel: () => void }) {
  const { state, signOut } = useAuth();
  const { deleteAccount } = useProfile();
  const id = useId();
  const email = state.status === 'signedIn' ? state.user.email : '';
  const [typed, setTyped] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed'>('idle');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const matches = typed.trim().toLowerCase() === email.toLowerCase();
    setMismatch(!matches);
    if (!matches) return;
    setStatus('busy');
    const result = await deleteAccount(typed);
    if (result === 'deleted') {
      await signOut();
      navigate('/');
      showNotice(t.accountDeleted);
      return;
    }
    setMismatch(result === 'mismatch');
    setStatus(result === 'mismatch' ? 'idle' : 'failed');
  };

  return (
    <form
      aria-label={t.deleteTitle}
      className="settings__form"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <div className="field">
        <label htmlFor={`${id}-email`}>{t.deleteConfirmLabel}</label>
        <input
          ref={input}
          id={`${id}-email`}
          type="email"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-invalid={mismatch}
          aria-describedby={`${id}-msg`}
        />
        <p id={`${id}-msg`} className={mismatch ? 'error-text' : 'hint'}>
          {t.deleteMismatch(email)}
        </p>
      </div>
      <p className="row">
        <button type="submit" className="btn btn-danger" disabled={status === 'busy'}>
          {status === 'busy' ? t.deleting : t.deleteConfirm}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t.cancel}
        </button>
      </p>
      {status === 'failed' && (
        <p role="alert" className="error-text">
          {t.deleteFailed}
        </p>
      )}
    </form>
  );
}
