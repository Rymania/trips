import { t } from '../i18n';
import { Link } from './Link';

/** Stands in for Settings (US4) until it lands. */
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
