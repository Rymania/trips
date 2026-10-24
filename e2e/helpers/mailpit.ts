/** Reads sign-in emails from the local Supabase stack's Mailpit. */
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

interface Summary {
  ID: string;
  Created: string;
}
interface Message {
  Text: string;
  HTML: string;
}

/** A unique address per test so parallel tests never read each other's mail. */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@trips.test`;
}

async function latestMessage(to: string, since: Date): Promise<Message | null> {
  const query = encodeURIComponent(`to:"${to}"`);
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${query}`);
  if (!res.ok) return null;
  const { messages } = (await res.json()) as { messages: Summary[] };
  // Mailpit stores whole seconds; allow for that when comparing to `since`.
  const fresh = messages.find((m) => new Date(m.Created).getTime() >= since.getTime() - 1000);
  if (!fresh) return null;
  return (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as Message;
}

function parse(msg: Message): { code: string; link: string } | null {
  const code = />\s*(\d{6})\s*</.exec(msg.HTML)?.[1] ?? /\b(\d{6})\b/.exec(msg.Text)?.[1];
  const href = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(msg.HTML)?.[1];
  return code && href ? { code, link: href.replaceAll('&amp;', '&') } : null;
}

/** Polls Mailpit until a sign-in email to `to` arrives after `since`. */
export async function latestSignInEmail(
  to: string,
  since: Date,
  timeoutMs = 15_000,
): Promise<{ code: string; link: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const msg = await latestMessage(to, since);
    const parsed = msg && parse(msg);
    if (parsed) return parsed;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email for ${to} within ${timeoutMs}ms`);
}
