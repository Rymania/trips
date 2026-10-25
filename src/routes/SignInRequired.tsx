import { t } from '../i18n';
import { Link } from './Link';

/** Stands in for a signed-in page: asks to sign in, or explains accounts are off. */
export function SignInRequired({
  title,
  text,
  next,
  disabled,
}: {
  title: string;
  text: string;
  next: string;
  disabled: boolean;
}) {
  return (
    <section className="page narrow card form-card" aria-labelledby="sign-in-required-title">
      <h2 id="sign-in-required-title">{title}</h2>
      <p>{disabled ? t.accountsUnavailable : text}</p>
      {disabled ? (
        <Link className="btn" to="/">
          {t.backToSearch}
        </Link>
      ) : (
        <Link className="btn btn-primary" to={`/sign-in?next=${encodeURIComponent(next)}`}>
          {t.signIn}
        </Link>
      )}
    </section>
  );
}
