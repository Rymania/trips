import { useState } from 'react';
import { useTheme } from '../../account/ProfileProvider';
import { ThemeSwitch } from '../../components/ThemeSwitch';
import { t } from '../../i18n';

/** Settings → Appearance (spec 005 US5). */
export function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  const [failed, setFailed] = useState(false);
  return (
    <section
      id="appearance"
      className="card form-card settings__section"
      aria-labelledby="appearance-title"
    >
      <h3 id="appearance-title">{t.appearance}</h3>
      <p className="hint">{t.appearanceIntro}</p>
      <ThemeSwitch
        value={preference}
        onChange={(pref) => void setPreference(pref).then((ok) => setFailed(!ok))}
      />
      {failed && (
        <p role="alert" className="error-text">
          {t.themeSaveFailed}
        </p>
      )}
    </section>
  );
}
