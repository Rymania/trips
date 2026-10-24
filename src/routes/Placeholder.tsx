import { t } from '../i18n';
import { Link } from './Link';

/** Stands in for Saved trips (US2) and Settings (US4) until they land. */
export default function Placeholder() {
  return (
    <section className="page narrow card form-card" aria-labelledby="soon-title">
      <h2 id="soon-title">{t.comingSoonTitle}</h2>
      <p>{t.comingSoon}</p>
      <Link className="btn" to="/">
        {t.backToSearch}
      </Link>
    </section>
  );
}
