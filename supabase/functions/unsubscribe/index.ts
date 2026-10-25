import { createClient } from '@supabase/supabase-js';
import { createHandler } from './handler.ts';

// The service role bypasses RLS: the caller isn't signed in, and the signed
// link is the only proof of who they are.
const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

Deno.serve(
  createHandler({
    signingKey: Deno.env.get('UNSUBSCRIBE_SIGNING_KEY'),
    optOut: async (profileId, topic) => {
      // No row means "never opted in", so an update is enough.
      const { error } = await admin
        .from('contact_preferences')
        .update({ opted_in: false })
        .eq('profile_id', profileId)
        .eq('topic', topic);
      if (error) throw error;
    },
  }),
);
