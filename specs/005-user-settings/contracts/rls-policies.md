# Contract: Row-level security policies (005)

These policies are the authorization contract for user data. Each one is covered by a pgTAP test in `supabase/tests/005_user_settings_rls.test.sql`. The tests use two users, A and B, plus an anonymous caller.

`auth.uid()` is always wrapped as `(select auth.uid())` so Postgres evaluates it once per query.

| Table                 | Operation | Role            | Condition                                                         |
| --------------------- | --------- | --------------- | ----------------------------------------------------------------- |
| `profiles`            | select    | `authenticated` | `id = (select auth.uid())`                                        |
| `profiles`            | update    | `authenticated` | Same condition in `using` and `with check`                        |
| `profiles`            | insert or delete | none     | Rows are only created by the trigger and only removed by deleting the account |
| `family_members`      | all       | `authenticated` | `profile_id = (select auth.uid())` in `using` and `with check`    |
| `saved_trips`         | all       | `authenticated` | `profile_id = (select auth.uid())` in `using` and `with check`    |
| `contact_preferences` | all       | `authenticated` | `profile_id = (select auth.uid())` in `using` and `with check`    |

The `anon` role gets no grants on these tables.

## Required test cases

1. User A can select, insert, update and delete their own rows in each table.
2. User A selecting from any table returns none of user B's rows.
3. User A can't insert a row with `profile_id = B`, and can't update a row to have it. Both fail the `with check` and raise an error.
4. User A can't update or delete user B's rows. No rows are affected.
5. An anonymous caller selecting from any table gets a permission error.
6. Inserting into `auth.users` creates a matching `profiles` row with `theme = 'system'`.
7. Deleting a user from `auth.users` removes all of that user's rows in all four tables.
8. The constraints reject bad data: a child without a birth month and year, an adult with them, a nickname of 31 characters, a note of 501 characters, a 21st family member, and an unknown theme.
