import { useId } from 'react';
import type { ThemePreference } from '../account/types';
import { t } from '../i18n';

const OPTIONS: [ThemePreference, string][] = [
  ['system', t.themeSystem],
  ['light', t.themeLight],
  ['dark', t.themeDark],
];

/** The three theme choices as a radio group, used in the header and in Settings. */
export function ThemeSwitch({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (pref: ThemePreference) => void;
}) {
  const name = useId();
  return (
    <fieldset className="theme-switch">
      <legend>{t.theme}</legend>
      <div className="chips">
        {OPTIONS.map(([pref, label]) => (
          <label key={pref} className="chip">
            <input
              type="radio"
              name={name}
              value={pref}
              checked={value === pref}
              onChange={() => onChange(pref)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
