import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** The local stack's signing key, read from supabase/config.toml so it lives in one place. */
function signingKey(): string {
  if (process.env.UNSUBSCRIBE_SIGNING_KEY) return process.env.UNSUBSCRIBE_SIGNING_KEY;
  const config = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8');
  const key = /^UNSUBSCRIBE_SIGNING_KEY\s*=\s*"([^"]+)"/m.exec(config)?.[1];
  if (!key) throw new Error('UNSUBSCRIBE_SIGNING_KEY not found in supabase/config.toml');
  return key;
}

const FUNCTIONS = process.env.FUNCTIONS_URL ?? 'http://127.0.0.1:54321/functions/v1';

/** The link an email would carry, signed as supabase/functions/_shared/unsubscribe.ts does. */
export function unsubscribeLink(profileId: string, topic: 'product_news' | 'nearby_digest') {
  const s = createHmac('sha256', signingKey()).update(`${profileId}:${topic}`).digest('hex');
  const url = new URL(`${FUNCTIONS}/unsubscribe`);
  url.search = new URLSearchParams({ u: profileId, t: topic, s }).toString();
  return url.toString();
}
