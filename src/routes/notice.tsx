import { useSyncExternalStore } from 'react';
import { t } from '../i18n';

/**
 * A one-off message shown under the header, e.g. after deleting an account,
 * when the page that caused it has gone. In memory only: a reload clears it.
 */
let message: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showNotice(text: string) {
  message = text;
  emit();
}

/** Returns and clears the current message. */
export function takeNotice(): string | null {
  const current = message;
  message = null;
  emit();
  return current;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function Notice() {
  const text = useSyncExternalStore(subscribe, () => message);
  if (!text) return null;
  return (
    <div role="status" className="notice">
      <p>{text}</p>
      <button type="button" className="btn" onClick={() => takeNotice()}>
        {t.dismiss}
      </button>
    </div>
  );
}
