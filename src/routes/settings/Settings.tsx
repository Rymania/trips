import { useAuth } from '../../account/AuthProvider';
import { t } from '../../i18n';
import { SignInRequired } from '../SignInRequired';
import { AppearanceSection } from './AppearanceSection';
import { FamilySection } from './FamilySection';
import { ProfileSection } from './ProfileSection';

/** Sections in page order; later stories add Contact and Your data. */
const SECTIONS = [
  { id: 'profile', label: t.profile, Section: ProfileSection },
  { id: 'family', label: t.family, Section: FamilySection },
  { id: 'appearance', label: t.appearance, Section: AppearanceSection },
];

/** Settings page (spec 005 FR-004): only available when signed in. */
export default function Settings() {
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
        title={t.settings}
        text={t.settingsSignedOut}
        next="/settings"
        disabled={state.status === 'disabled'}
      />
    );
  }
  return (
    <div className="page settings">
      <h2>{t.settings}</h2>
      <div className="settings__layout">
        <nav className="settings__nav" aria-label={t.settingsSections}>
          <ul>
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="settings__sections">
          {SECTIONS.map(({ id, Section }) => (
            <Section key={id} />
          ))}
        </div>
      </div>
    </div>
  );
}
