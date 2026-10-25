/**
 * Signed unsubscribe links (specs/005-user-settings research R7). Emails put
 * `unsubscribeUrl()` in the body and in a List-Unsubscribe header, so the
 * future email feature only needs this module and UNSUBSCRIBE_SIGNING_KEY.
 */
export const TOPICS = ['product_news', 'nearby_digest'] as const;
export type Topic = (typeof TOPICS)[number];

const encoder = new TextEncoder();

function importKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Hex HMAC-SHA256 of `profileId:topic`. */
export async function signUnsubscribe(secret: string, profileId: string, topic: Topic) {
  const key = await importKey(secret);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${profileId}:${topic}`)));
}

/** Checks a signature in constant time (WebCrypto's verify). */
export async function verifyUnsubscribe(
  secret: string,
  profileId: string,
  topic: Topic,
  signature: string,
): Promise<boolean> {
  const bytes = fromHex(signature);
  if (!bytes) return false;
  const key = await importKey(secret);
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`${profileId}:${topic}`));
}

/** The link for one person and topic, e.g. `${SUPABASE_URL}/functions/v1/unsubscribe`. */
export async function unsubscribeUrl(
  endpoint: string,
  secret: string,
  profileId: string,
  topic: Topic,
): Promise<string> {
  const url = new URL(endpoint);
  url.searchParams.set('u', profileId);
  url.searchParams.set('t', topic);
  url.searchParams.set('s', await signUnsubscribe(secret, profileId, topic));
  return url.toString();
}
