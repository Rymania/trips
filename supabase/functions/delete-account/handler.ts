import { bearerToken, type Caller } from '../_shared/auth.ts';
import { corsHeaders, preflight } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/errors.ts';

export interface Deps {
  getCaller: (token: string) => Promise<Caller | null>;
  /** Deletes the Auth user; every table cascades from it (research R8). */
  deleteUser: (id: string) => Promise<void>;
}

const CORS = corsHeaders('POST');
const normalise = (email: string) => email.trim().toLowerCase();

async function confirmEmail(req: Request): Promise<string | null | undefined> {
  try {
    const body = (await req.json()) as { confirmEmail?: unknown };
    return typeof body?.confirmEmail === 'string' ? body.confirmEmail : null;
  } catch {
    return undefined; // not JSON
  }
}

/** POST /delete-account { confirmEmail }: permanently deletes the caller (spec 005 US7). */
export function createHandler({ getCaller, deleteUser }: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return preflight('POST');
    if (req.method !== 'POST') {
      return errorResponse(405, 'method_not_allowed', 'Use POST.', { ...CORS, allow: 'POST' });
    }
    const token = bearerToken(req);
    const caller = token ? await getCaller(token) : null;
    if (!caller) {
      return errorResponse(401, 'unauthorized', 'Sign in to delete your account.', CORS);
    }
    const email = await confirmEmail(req);
    if (email === undefined) {
      return errorResponse(400, 'bad_request', 'Send JSON with confirmEmail.', CORS);
    }
    if (!email) {
      return errorResponse(400, 'confirm_email_required', 'Type your email to confirm.', CORS);
    }
    if (normalise(email) !== normalise(caller.email)) {
      return errorResponse(400, 'confirm_email_mismatch', 'That isn’t your email.', CORS);
    }
    try {
      await deleteUser(caller.id);
    } catch (error) {
      console.error('Delete failed', error);
      return errorResponse(500, 'delete_failed', 'We couldn’t delete your account.', CORS);
    }
    return new Response(null, { status: 204, headers: CORS });
  };
}
