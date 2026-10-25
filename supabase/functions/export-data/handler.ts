import { bearerToken, type Caller } from '../_shared/auth.ts';
import { corsHeaders, preflight } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/errors.ts';

export interface ExportData {
  profile: Record<string, unknown> | null;
  familyMembers: Record<string, unknown>[];
  savedTrips: Record<string, unknown>[];
  contactPreferences: Record<string, unknown>[];
}

export interface Deps {
  getCaller: (token: string) => Promise<Caller | null>;
  /** Reads with the caller's own token, so row-level security limits it to their rows. */
  loadData: (token: string, callerId: string) => Promise<ExportData>;
  now?: () => Date;
}

const CORS = corsHeaders('GET');

/** GET /export-data: everything Trips stores about the caller (spec 005 US7, UK GDPR). */
export function createHandler({ getCaller, loadData, now = () => new Date() }: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return preflight('GET');
    if (req.method !== 'GET') {
      return errorResponse(405, 'method_not_allowed', 'Use GET.', { ...CORS, allow: 'GET' });
    }
    const token = bearerToken(req);
    const caller = token ? await getCaller(token) : null;
    if (!token || !caller) {
      return errorResponse(401, 'unauthorized', 'Sign in to download your data.', CORS);
    }
    try {
      const data = await loadData(token, caller.id);
      const exportedAt = now();
      const day = exportedAt.toISOString().slice(0, 10);
      const body = {
        exportedAt: exportedAt.toISOString(),
        account: {
          email: caller.email,
          createdAt: caller.createdAt,
          lastSignInAt: caller.lastSignInAt,
        },
        ...data,
      };
      return Response.json(body, {
        headers: {
          ...CORS,
          'cache-control': 'no-store',
          'content-disposition': `attachment; filename="family-day-planner-data-${day}.json"`,
        },
      });
    } catch (error) {
      console.error('Export failed', error);
      return errorResponse(500, 'export_failed', 'We couldn’t gather your data.', CORS);
    }
  };
}
