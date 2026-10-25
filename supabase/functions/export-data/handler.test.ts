import { assertEquals, assertMatch } from '@std/assert';
import type { Caller } from '../_shared/auth.ts';
import { createHandler, type ExportData } from './handler.ts';

const URL_ = 'http://127.0.0.1:54321/functions/v1/export-data';
const CALLER: Caller = {
  id: 'user-a',
  email: 'a@trips.test',
  createdAt: '2026-10-01T09:00:00Z',
  lastSignInAt: '2026-10-25T09:00:00Z',
};
const DATA: ExportData = {
  profile: { id: 'user-a', display_name: 'Sam' },
  familyMembers: [{ nickname: 'Robin' }],
  savedTrips: [{ activity_id: 'sample-1' }],
  contactPreferences: [],
};

function setup(fail = false) {
  const loads: [string, string][] = [];
  const handler = createHandler({
    getCaller: (token) => Promise.resolve(token === 'good-token' ? CALLER : null),
    loadData: (token, id) => {
      loads.push([token, id]);
      return fail ? Promise.reject(new Error('db down')) : Promise.resolve(DATA);
    },
    now: () => new Date('2026-10-25T12:34:56Z'),
  });
  return { handler, loads };
}

const get = (token?: string) =>
  new Request(URL_, { headers: token ? { authorization: `Bearer ${token}` } : {} });

Deno.test('answers the CORS preflight', async () => {
  const res = await setup().handler(new Request(URL_, { method: 'OPTIONS' }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get('access-control-allow-origin'), '*');
  assertMatch(res.headers.get('access-control-allow-headers') ?? '', /authorization/);
});

Deno.test('rejects a missing or invalid token with 401', async () => {
  const { handler, loads } = setup();
  for (const req of [get(), get('bad-token')]) {
    const res = await handler(req);
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, 'unauthorized');
    assertEquals(res.headers.get('access-control-allow-origin'), '*');
  }
  assertEquals(loads, []);
});

Deno.test('returns only the caller’s data as a JSON download', async () => {
  const { handler, loads } = setup();
  const res = await handler(get('good-token'));
  assertEquals(res.status, 200);
  assertEquals(
    res.headers.get('content-disposition'),
    'attachment; filename="family-day-planner-data-2026-10-25.json"',
  );
  assertEquals(res.headers.get('cache-control'), 'no-store');
  // Loaded with the caller's own token, so row-level security applies too.
  assertEquals(loads, [['good-token', 'user-a']]);
  assertEquals(await res.json(), {
    exportedAt: '2026-10-25T12:34:56.000Z',
    account: {
      email: 'a@trips.test',
      createdAt: '2026-10-01T09:00:00Z',
      lastSignInAt: '2026-10-25T09:00:00Z',
    },
    ...DATA,
  });
});

Deno.test('reports a failed export with 500', async () => {
  const res = await setup(true).handler(get('good-token'));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error.code, 'export_failed');
});

Deno.test('only GET is allowed', async () => {
  const res = await setup().handler(new Request(URL_, { method: 'POST' }));
  assertEquals(res.status, 405);
  await res.body?.cancel();
});
