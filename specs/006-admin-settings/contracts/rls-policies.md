# Contract: Row-level security and authorization (006)

Tests live in `supabase/tests/006_admin_settings_rls.test.sql`. The fixtures are an admin (A), a second admin (A2), a normal user (U), a deactivated user (D) and an anonymous caller.

## Table policies

| Table                   | Operation              | Role                    | Condition                                                         |
| ----------------------- | ---------------------- | ----------------------- | ----------------------------------------------------------------- |
| `user_roles`            | select                 | authenticated           | `user_id = (select auth.uid()) or (select public.is_admin())`     |
| `user_roles`            | insert, update, delete | authenticated           | `(select public.is_admin())`                                      |
| `profiles` (added)      | select, update         | authenticated           | `(select public.is_admin())`                                      |
| `app_banners`           | all                    | authenticated           | `(select public.is_admin())`                                      |
| `active_banner` (view)  | select                 | anon, authenticated     | Public. Shows only the safe columns                               |
| `feature_flags`         | select                 | anon, authenticated     | Public. Flag settings only (ADR 0002)                             |
| `feature_flags`         | insert, update, delete | authenticated           | `(select public.is_admin())`                                      |
| `activity_events`       | select                 | authenticated           | `(select public.is_admin())`                                      |
| `activity_events`       | insert, update, delete | none                    | Written only through `track_event()`                              |
| `daily_activity_totals` | select                 | authenticated           | `(select public.is_admin())`                                      |
| `admin_audit_log`       | select                 | authenticated           | `(select public.is_admin())`                                      |
| `admin_audit_log`       | insert, update, delete | none                    | Written only by triggers and Edge Functions                       |

**Changes to 005's policies**: every `insert`, `update` and `delete` policy on `profiles`, `family_members`, `saved_trips` and `contact_preferences` adds `and (select public.is_active())`. Admins can change `profiles.status*` only through the `admin-set-status` Edge Function. A column-level trigger refuses status changes made through the REST API.

## Required test cases

1. U, D and anonymous get zero rows or a permission error from every admin-only table and every `admin_*` function.
2. A can read all profiles, can update U's display name, and that update creates one `user.edit` audit entry.
3. A can grant A2 the admin role and revoke it, and each change creates one `role.grant` or `role.revoke` audit entry.
4. Revoking the last remaining admin raises `there must be at least one admin`. So does two admins revoking each other at the same moment: of two concurrent transactions, only one succeeds.
5. U can't add a row to `user_roles` for themselves.
6. D can still `select` their own data, but every `insert`, `update` or `delete` on 005 tables is refused.
7. Anonymous can read `active_banner` and `feature_flags`, but can't change them.
8. `track_event` refuses an unknown `kind`, a subject containing spaces or longer than 200 characters, any call by D, and the 121st call within a minute.
9. Nobody, including A, can update or delete `admin_audit_log` rows through the API.
10. `custom_access_token_hook` adds `user_role: 'admin'` for A and `'user'` for U.
11. `rollup_daily_totals(day)` produces the expected counts from fixture events and deletes events older than the retention period.
