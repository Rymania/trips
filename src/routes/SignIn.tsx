import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth, type AuthFailure } from '../account/AuthProvider';
import { t } from '../i18n';
import { EMAIL } from './email';
import { Link } from './Link';
import { rememberNext, safeNext, takeNext } from './next';
import { navigate } from './useRoute';

const CODE = /^\d{6}$/;

const failureText: Record<AuthFailure, string> = {
  expired: t.codeExpired,
  rateLimited: t.rateLimited,
  unavailable: t.accountsUnavailable,
  failed: t.signInFailed,
};

export { safeNext };

export default function SignIn() {
  const { state, sendCode, verifyCode } = useAuth();
  const next = safeNext(new URLSearchParams(window.location.search).get('next'));
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');

  useEffect(() => {
    if (state.status !== 'signedIn') return;
    takeNext(); // signed in here, so a stale emailed link mustn't redirect later
    navigate(next, { replace: true });
  }, [state.status, next]);

  if (state.status === 'disabled') {
    return (
      <section className="page narrow" aria-labelledby="sign-in-title">
        <h2 id="sign-in-title">{t.signInTitle}</h2>
        <p>{t.accountsUnavailable}</p>
        <Link className="btn" to="/">
          {t.backToSearch}
        </Link>
      </section>
    );
  }

  return (
    <section className="page narrow">
      {step === 'email' ? (
        <EmailStep
          email={email}
          onEmail={setEmail}
          send={(value) => {
            rememberNext(next);
            return sendCode(value);
          }}
          onSent={(normalised) => {
            setEmail(normalised);
            setStep('code');
          }}
        />
      ) : (
        <CodeStep
          email={email}
          verify={verifyCode}
          resend={sendCode}
          onBack={() => setStep('email')}
          onSignedIn={() => navigate(next, { replace: true })}
        />
      )}
    </section>
  );
}

function EmailStep({
  email,
  onEmail,
  send,
  onSent,
}: {
  email: string;
  onEmail: (v: string) => void;
  send: ReturnType<typeof useAuth>['sendCode'];
  onSent: (normalised: string) => void;
}) {
  const [invalid, setInvalid] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    setInvalid(!EMAIL.test(value));
    setFailure(null);
    if (!EMAIL.test(value)) return;
    setBusy(true);
    const res = await send(value);
    setBusy(false);
    if (res.ok) onSent(value);
    else setFailure(res.reason);
  };

  return (
    <form className="card form-card" noValidate onSubmit={(e) => void submit(e)}>
      <h2>{t.signInTitle}</h2>
      <p className="hint">{t.signInIntro}</p>
      {failure && (
        <p role="alert" className="banner">
          {failureText[failure]}
        </p>
      )}
      <div className="field">
        <label htmlFor="sign-in-email">{t.emailLabel}</label>
        <input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        />
        {invalid && (
          <p id={errorId} className="error-text">
            {t.emailInvalid}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? t.sending : t.sendCode}
      </button>
    </form>
  );
}

function CodeStep({
  email,
  verify,
  resend,
  onBack,
  onSignedIn,
}: {
  email: string;
  verify: ReturnType<typeof useAuth>['verifyCode'];
  resend: ReturnType<typeof useAuth>['sendCode'];
  onBack: () => void;
  onSignedIn: () => void;
}) {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorId = useId();

  useEffect(() => heading.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = code.replace(/\s+/g, '');
    setInvalid(!CODE.test(value));
    setFailure(null);
    if (!CODE.test(value)) return;
    setBusy(true);
    const res = await verify(email, value);
    setBusy(false);
    if (res.ok) onSignedIn();
    else setFailure(res.reason);
  };
  const sendAgain = async () => {
    setFailure(null);
    const res = await resend(email);
    if (!res.ok) setFailure(res.reason);
  };

  return (
    <form className="card form-card" noValidate onSubmit={(e) => void submit(e)}>
      <h2 ref={heading} tabIndex={-1}>
        {t.checkEmailTitle}
      </h2>
      <p>{t.checkEmail(email)}</p>
      {failure && (
        <p role="alert" className="banner">
          {failureText[failure]}
        </p>
      )}
      <div className="field">
        <label htmlFor="sign-in-code">{t.codeLabel}</label>
        <input
          id="sign-in-code"
          className="code-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={11}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        />
        {invalid && (
          <p id={errorId} className="error-text">
            {t.codeInvalid}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? t.verifying : t.verify}
      </button>
      <p className="row">
        <button type="button" className="link" onClick={() => void sendAgain()}>
          {t.resendCode}
        </button>
        <button type="button" className="link" onClick={onBack}>
          {t.useDifferentEmail}
        </button>
      </p>
    </form>
  );
}
