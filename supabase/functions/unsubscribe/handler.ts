import { TOPICS, type Topic, verifyUnsubscribe } from '../_shared/unsubscribe.ts';

export interface Deps {
  /** UNSUBSCRIBE_SIGNING_KEY; without it every request fails closed. */
  signingKey: string | undefined;
  /** Turns one topic off for one profile. */
  optOut: (profileId: string, topic: Topic) => Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const TOPIC_NAMES: Record<Topic, string> = {
  product_news: 'news about Family Day Planner',
  nearby_digest: 'emails about activities near you',
};

function page(status: number, title: string, message: string) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:24px;background:#faf6f0;color:#2e3230;font-family:system-ui,sans-serif;line-height:1.6">
    <main style="max-width:480px;margin:0 auto;background:#f3ede3;border-radius:12px;padding:24px">
      <h1 style="font-family:Georgia,serif;color:#3d6a4b;font-size:22px;margin:0 0 12px">${title}</h1>
      <p style="margin:0">${message}</p>
    </main>
  </body>
</html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** The signed query, or null if anything is missing, malformed or tampered with. */
async function verifiedQuery(url: URL, key: string) {
  const u = url.searchParams.get('u') ?? '';
  const t = url.searchParams.get('t') ?? '';
  const s = url.searchParams.get('s') ?? '';
  if (!UUID.test(u) || !(TOPICS as readonly string[]).includes(t)) return null;
  const topic = t as Topic;
  return (await verifyUnsubscribe(key, u, topic, s)) ? { profileId: u, topic } : null;
}

/**
 * GET shows a confirmation page; POST is the RFC 8058 one-click form that
 * mail providers send. Neither needs the user to sign in (spec 005 US6).
 */
export function createHandler({ signingKey, optOut }: Deps) {
  return async (req: Request): Promise<Response> => {
    const post = req.method === 'POST';
    if (req.method !== 'GET' && !post) {
      return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
    }
    if (!signingKey) {
      console.error('UNSUBSCRIBE_SIGNING_KEY is not set');
      return page(500, 'Something went wrong', 'Please try the link again later.');
    }
    const query = await verifiedQuery(new URL(req.url), signingKey);
    if (!query) {
      return post
        ? new Response(null, { status: 400 })
        : page(
            400,
            'This link doesn’t work',
            'It may have been changed or copied incompletely. Use the link from the email, or change your choices in Settings.',
          );
    }
    try {
      await optOut(query.profileId, query.topic);
    } catch (error) {
      console.error('Unsubscribe failed', error);
      return page(
        500,
        'Something went wrong',
        'We couldn’t update your choices. Please try the link again in a few minutes.',
      );
    }
    return post
      ? new Response(null, { status: 204 })
      : page(
          200,
          'You’re unsubscribed',
          `You’ve been unsubscribed from ${TOPIC_NAMES[query.topic]}. You can turn it back on in Settings at any time.`,
        );
  };
}
