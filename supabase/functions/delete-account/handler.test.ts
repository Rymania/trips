import { assertEquals } from '@std/assert';
import type { Caller } from '../_shared/auth.ts';
import { createHandler } from './handler.ts';

const URL_ = 'http://127.0.0.1:54321/functions/v1/delete-account';
const CALLER: Caller = {
  id: 'user-a',
  email: 'a@trips.test',
  createdAt: '2026-10-01T09:00:00Z',
  lastSignInAt: null,
};

function setup(fail = false) {
  const deleted: string[] = [];
  const handler = createHandler({
    getCaller: (token) => Promise.resolve(token === 'good-token' ? CALLER : null),
    deleteUser: (id) => {
      deleted.push(id);
      return fail ? Promise.reject(new Error('auth down')) : Promise.resolve();
    },
  });
  return { handler, deleted };
}

const post = (body: unknown, token: string | null = 'good-token') =>
  new Request(URL_, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function errorCode(res: Response) {
  return (await res.json()).error.code as string;
}

Deno.test('answers the CORS preflight', async () => {
  const res = await setup().handler(new Request(URL_, { method: 'OPTIONS' }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});

Deno.test('rejects a missing or invalid token with 401', async () => {
  const { handler, deleted } = setup();
  for (const token of [null, 'bad-token']) {
    const res = await handler(post({ confirmEmail: 'a@trips.test' }, token));
    assertEquals(res.status, 401);
    assertEquals(await errorCode(res), 'unauthorized');
  }
  assertEquals(deleted, []);
});

Deno.test('a wrong or missing email gives 400 and deletes nothing', async () => {
  const { handler, deleted } = setup();
  const cases: [unknown, string][] = [
    [{ confirmEmail: 'someone@else.test' }, 'confirm_email_mismatch'],
    [{}, 'confirm_email_required'],
    [{ confirmEmail: 42 }, 'confirm_email_required'],
    ['{not json', 'bad_request'],
  ];
  for (const [body, code] of cases) {
    const res = await handler(post(body));
    assertEquals(res.status, 400);
    assertEquals(await errorCode(res), code);
  }
  assertEquals(deleted, []);
});

Deno.test('the matching email deletes the caller, ignoring case and spaces', async () => {
  const { handler, deleted } = setup();
  const res = await handler(post({ confirmEmail: '  A@Trips.test ' }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get('access-control-allow-origin'), '*');
  assertEquals(deleted, ['user-a']);
});

Deno.test('reports a failed deletion with 500', async () => {
  const res = await setup(true).handler(post({ confirmEmail: 'a@trips.test' }));
  assertEquals(res.status, 500);
  assertEquals(await errorCode(res), 'delete_failed');
});

Deno.test('only POST is allowed', async () => {
  const res = await setup().handler(new Request(URL_));
  assertEquals(res.status, 405);
  await res.body?.cancel();
});
