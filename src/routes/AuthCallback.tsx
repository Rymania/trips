import { useEffect, useState } from 'react';
import { useAuth } from '../account/AuthProvider';
import { t } from '../i18n';
import { Link } from './Link';
import { takeNext } from './next';
import { navigate } from './useRoute';

function linkError(): boolean {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return query.has('error') || hash.has('error');
}

/**
 * Landing page for the emailed sign-in link. supabase-js exchanges the `code`
 * in the URL as soon as it loads (PKCE), so all this page does is load it.
 */
export default function AuthCallback() {
  const { state, connect } = useAuth();
  const [failed] = useState(linkError);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (failed) return;
    void connect().finally(() => setStarted(true));
  }, [connect, failed]);

  useEffect(() => {
    if (state.status === 'signedIn') navigate(takeNext(), { replace: true });
  }, [state.status]);

  const signedOut = state.status === 'anonymous' || state.status === 'disabled';
  if (failed || (started && signedOut)) {
    return (
      <section className="page narrow">
        <div role="alert" className="banner">
          <p>{t.callbackFailed}</p>
          <Link className="btn btn-primary" to="/sign-in">
            {t.requestNewLink}
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="page narrow">
      <p role="status" className="skeleton skeleton--short">
        {t.callbackWorking}
      </p>
    </section>
  );
}
