import { createClient } from '@supabase/supabase-js';
import { callerFor } from '../_shared/auth.ts';
import { createHandler } from './handler.ts';

// Deleting an Auth user needs the service role, which never leaves the server.
const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

Deno.serve(
  createHandler({
    getCaller: (token) => callerFor(admin, token),
    deleteUser: async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    },
  }),
);
