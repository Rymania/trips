import { assert, assertEquals, assertMatch } from '@std/assert';
import { signUnsubscribe, unsubscribeUrl, verifyUnsubscribe } from '../_shared/unsubscribe.ts';
import { createHandler } from './handler.ts';

const KEY = 'test-signing-key';
const USER = '6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b';
const BASE = 'http://127.0.0.1:54321/functions/v1/unsubscribe';

function setup(signingKey: string = KEY, fail = false) {
  const calls: [string, string][] = [];
  const handler = createHandler({
    signingKey,
    optOut: (profileId, topic) => {
      calls.push([profileId, topic]);
      return fail ? Promise.reject(new Error('db down')) : Promise.resolve();
    },
  });
  return { handler, calls };
}

const link = (topic = 'nearby_digest', user = USER, key = KEY) =>
  unsubscribeUrl(BASE, key, user, topic as 'nearby_digest');

Deno.test('signatures are hex HMAC-SHA256 of "user:topic" and verify', async () => {
  const s = await signUnsubscribe(KEY, USER, 'product_news');
  assertMatch(s, /^[0-9a-f]{64}$/);
  assertEquals(s, await signUnsubscribe(KEY, USER, 'product_news'));
  assert(await verifyUnsubscribe(KEY, USER, 'product_news', s));
  assert(!(await verifyUnsubscribe(KEY, USER, 'nearby_digest', s)));
  assert(!(await verifyUnsubscribe('other-key', USER, 'product_news', s)));
  assert(!(await verifyUnsubscribe(KEY, USER, 'product_news', 'zz')));
});

Deno.test('the link carries the user, topic and signature', async () => {
  const url = new URL(await link('product_news'));
  assertEquals(url.origin + url.pathname, BASE);
  assertEquals(url.searchParams.get('u'), USER);
  assertEquals(url.searchParams.get('t'), 'product_news');
  assertEquals(url.searchParams.get('s'), await signUnsubscribe(KEY, USER, 'product_news'));
});

Deno.test('GET with a valid signature turns the option off and confirms', async () => {
  const { handler, calls } = setup();
  const res = await handler(new Request(await link()));
  assertEquals(res.status, 200);
  assertMatch(res.headers.get('content-type') ?? '', /text\/html/);
  assertMatch(await res.text(), /unsubscribed from emails about activities near you/i);
  assertEquals(calls, [[USER, 'nearby_digest']]);
});

Deno.test('a changed signature, user or topic is rejected with 400', async () => {
  const { handler, calls } = setup();
  const url = new URL(await link());
  const tampered = [
    (u: URL) => u.searchParams.set('s', '0'.repeat(64)),
    (u: URL) => u.searchParams.set('u', '00000000-0000-4000-8000-000000000000'),
    (u: URL) => u.searchParams.set('t', 'product_news'),
    (u: URL) => u.searchParams.set('t', 'everything'),
    (u: URL) => u.searchParams.set('u', 'not-a-uuid'),
    (u: URL) => u.searchParams.delete('s'),
  ];
  for (const change of tampered) {
    const bad = new URL(url);
    change(bad);
    const res = await handler(new Request(bad));
    assertEquals(res.status, 400, bad.search);
    await res.body?.cancel();
  }
  assertEquals(calls, []);
});

Deno.test('POST is the RFC 8058 one-click flow', async () => {
  const { handler, calls } = setup();
  const url = await link('product_news');
  const res = await handler(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    }),
  );
  assertEquals(res.status, 204);
  assertEquals(calls, [[USER, 'product_news']]);

  const bad = new URL(url);
  bad.searchParams.set('s', 'f'.repeat(64));
  const rejected = await handler(new Request(bad, { method: 'POST' }));
  assertEquals(rejected.status, 400);
  assertEquals(calls.length, 1);
});

Deno.test('other methods are not allowed', async () => {
  const { handler } = setup();
  const res = await handler(new Request(await link(), { method: 'PUT' }));
  assertEquals(res.status, 405);
  assertEquals(res.headers.get('allow'), 'GET, POST');
  await res.body?.cancel();
});

Deno.test('fails closed without a signing key, and reports database errors', async () => {
  const noKey = setup(''); // an unset secret reads as empty or undefined
  const res = await noKey.handler(new Request(await link()));
  assertEquals(res.status, 500);
  assertEquals(noKey.calls, []);
  await res.body?.cancel();

  const broken = setup(KEY, true);
  const failed = await broken.handler(new Request(await link()));
  assertEquals(failed.status, 500);
  assertMatch(await failed.text(), /try the link again/i);
});
