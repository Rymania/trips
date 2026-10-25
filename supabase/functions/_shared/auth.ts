/** The signed-in user calling a function, as Auth knows them. */
export interface Caller {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
}

/** The access token from `Authorization: Bearer …`, if there is one. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

/** The one supabase-js call this needs (kept structural: _shared has no import map). */
interface AuthClient {
  auth: {
    getUser(token: string): Promise<{
      data: {
        user: { id: string; email?: string; created_at: string; last_sign_in_at?: string } | null;
      };
      error: unknown;
    }>;
  };
}

/**
 * Checks an access token with Auth. Functions set verify_jwt = false so the
 * CORS preflight can reach them, which makes this check the gate.
 */
export async function callerFor(admin: AuthClient, token: string): Promise<Caller | null> {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { id, email, created_at, last_sign_in_at } = data.user;
  return { id, email: email ?? '', createdAt: created_at, lastSignInAt: last_sign_in_at ?? null };
}
