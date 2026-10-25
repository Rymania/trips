import { createClient } from '@supabase/supabase-js';
import { callerFor } from '../_shared/auth.ts';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false },
});

/** Throws a PostgREST error rather than returning it. */
function rows<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error;
  return data;
}

Deno.serve(
  createHandler({
    getCaller: (token) => callerFor(admin, token),
    loadData: async (token, callerId) => {
      // A client acting as the caller: RLS returns only their rows.
      const db = createClient(url, anonKey, {
        auth: { persistSession: false },
        global: { headers: { authorization: `Bearer ${token}` } },
      });
      const [profile, familyMembers, savedTrips, contactPreferences] = await Promise.all([
        db.from('profiles').select('*').eq('id', callerId).maybeSingle(),
        db.from('family_members').select('*').eq('profile_id', callerId).order('sort_order'),
        db.from('saved_trips').select('*').eq('profile_id', callerId).order('saved_at'),
        db.from('contact_preferences').select('*').eq('profile_id', callerId),
      ]);
      return {
        profile: rows(profile),
        familyMembers: rows(familyMembers) ?? [],
        savedTrips: rows(savedTrips) ?? [],
        contactPreferences: rows(contactPreferences) ?? [],
      };
    },
  }),
);
