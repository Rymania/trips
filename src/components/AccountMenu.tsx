import { useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent } from 'react';
import { useAuth } from '../account/AuthProvider';
import { t } from '../i18n';
import { Link } from '../routes/Link';
import { navigate } from '../routes/useRoute';

/** Header sign-in link or account menu (spec 005 FR-003). */
export function AccountMenu() {
  const { state, signOut } = useAuth();
  switch (state.status) {
    case 'disabled':
      return null;
    case 'loading':
      return (
        <span className="account-pill account-pill--loading" aria-busy="true">
          <span className="visually-hidden">{t.accountLoading}</span>
        </span>
      );
    case 'anonymous': {
      const here = `${window.location.pathname}${window.location.search}`;
      return (
        <Link className="btn" to={`/sign-in?next=${encodeURIComponent(here)}`}>
          {t.signIn}
        </Link>
      );
    }
    case 'signedIn':
      return <SignedInMenu email={state.user.email} onSignOut={signOut} />;
  }
}

function SignedInMenu({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Escape closes the menu from anywhere while it's open, returning focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
  };
  const signOut = async () => {
    setOpen(false);
    navigate('/');
    await onSignOut();
  };

  return (
    <div className="account-menu" onBlur={onBlur}>
      <button
        ref={toggle}
        type="button"
        className="btn account-pill"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t.accountMenu(email)}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="account-pill__email">{email}</span>
      </button>
      {open && (
        <div id={panelId} className="account-menu__panel">
          <p className="account-menu__who">{t.signedInAs(email)}</p>
          <ul>
            <li>
              <Link to="/saved" onClick={() => setOpen(false)}>
                {t.savedTrips}
              </Link>
            </li>
            <li>
              <Link to="/settings" onClick={() => setOpen(false)}>
                {t.settings}
              </Link>
            </li>
            <li>
              <button type="button" className="link" onClick={() => void signOut()}>
                {t.signOut}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
