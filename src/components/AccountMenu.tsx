import { useContext, useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent, ReactNode } from 'react';
import { useAuth } from '../account/AuthProvider';
import { ProfileContext, ThemeContext, type ThemeApi } from '../account/ProfileProvider';
import { t } from '../i18n';
import { Link } from '../routes/Link';
import { navigate } from '../routes/useRoute';
import { ThemeSwitch } from './ThemeSwitch';

/** Header sign-in link, theme menu and account menu (spec 005 FR-003, US5). */
export function AccountMenu() {
  const { state, signOut } = useAuth();
  // Read directly so the menu also works outside ProfileProvider (e.g. in tests).
  const displayName = useContext(ProfileContext)?.profile?.displayName;
  const theme = useContext(ThemeContext);
  switch (state.status) {
    case 'disabled':
      return theme && <ThemeMenu theme={theme} />;
    case 'loading':
      return (
        <span className="account-pill account-pill--loading" aria-busy="true">
          <span className="visually-hidden">{t.accountLoading}</span>
        </span>
      );
    case 'anonymous': {
      const here = `${window.location.pathname}${window.location.search}`;
      return (
        <div className="header-actions">
          {theme && <ThemeMenu theme={theme} />}
          <Link className="btn" to={`/sign-in?next=${encodeURIComponent(here)}`}>
            {t.signIn}
          </Link>
        </div>
      );
    }
    case 'signedIn':
      return (
        <SignedInMenu
          name={displayName ?? state.user.email}
          email={state.user.email}
          theme={theme}
          onSignOut={signOut}
        />
      );
  }
}

/**
 * A button that opens a panel below it. Escape closes it from anywhere and
 * returns focus to the button; moving focus out of the menu closes it too.
 */
function Menu({
  label,
  buttonClass,
  button,
  children,
}: {
  label: string;
  buttonClass: string;
  button: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

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

  return (
    <div className="account-menu" onBlur={onBlur}>
      <button
        ref={toggle}
        type="button"
        className={buttonClass}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        {button}
      </button>
      {open && (
        <div id={panelId} className="account-menu__panel">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function ThemeMenu({ theme }: { theme: ThemeApi }) {
  return (
    <Menu label={t.theme} buttonClass="btn btn-icon" button={<span aria-hidden="true">◐</span>}>
      {() => <ThemeSwitch value={theme.preference} onChange={(p) => void theme.setPreference(p)} />}
    </Menu>
  );
}

function SignedInMenu({
  name,
  email,
  theme,
  onSignOut,
}: {
  name: string;
  email: string;
  theme: ThemeApi | null;
  onSignOut: () => Promise<void>;
}) {
  const signOut = async (close: () => void) => {
    close();
    navigate('/');
    await onSignOut();
  };

  return (
    <Menu
      label={t.accountMenu(name)}
      buttonClass="btn account-pill"
      button={
        <>
          <span className="avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="account-pill__email">{name}</span>
        </>
      }
    >
      {(close) => (
        <>
          <p className="account-menu__who">{t.signedInAs(email)}</p>
          {theme && (
            <ThemeSwitch value={theme.preference} onChange={(p) => void theme.setPreference(p)} />
          )}
          <ul>
            <li>
              <Link to="/saved" onClick={close}>
                {t.savedTrips}
              </Link>
            </li>
            <li>
              <Link to="/settings" onClick={close}>
                {t.settings}
              </Link>
            </li>
            <li>
              <button type="button" className="link" onClick={() => void signOut(close)}>
                {t.signOut}
              </button>
            </li>
          </ul>
        </>
      )}
    </Menu>
  );
}
