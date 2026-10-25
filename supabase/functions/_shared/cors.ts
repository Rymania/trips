/**
 * The app calls these functions from the browser with a bearer token (no
 * cookies), so any origin may call them; the token is what's checked.
 */
export function corsHeaders(methods: string): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': `${methods}, OPTIONS`,
  };
}

/** The answer to a CORS preflight. */
export const preflight = (methods: string) =>
  new Response(null, { status: 204, headers: corsHeaders(methods) });
