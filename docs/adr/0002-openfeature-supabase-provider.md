# ADR 0002: Feature flags through OpenFeature, with a Trips provider backed by Supabase

- **Status**: Proposed
- **Date**: 2026-10-24
- **Deciders**: Rymania
- **Relates to**: [#8 Admin settings](https://github.com/Rymania/trips/issues/8), spec `006-admin-settings`, [ADR 0001](0001-supabase-for-accounts.md)

## Context

Issue #8 asks for feature flags "set-up with openfeature framework", which admins manage from the app's own admin area. OpenFeature is a vendor-neutral API: application code checks flags through the SDK, and a _provider_ decides where flag values come from. We need to choose a provider.

## Options considered

1. **A custom `TripsFlagProvider`** that reads a `feature_flags` table in Supabase.
2. **flagd**, the OpenFeature reference flag service, run as an extra container with a JSON flag file or a sync source.
3. **A hosted flag service** with an OpenFeature provider, such as LaunchDarkly, Flagsmith or DevCycle.

## Decision

Use option 1. A small `TripsFlagProvider` implements the OpenFeature web `Provider` interface:

- **Loading**: it reads flag settings with a plain `fetch` to the Supabase REST endpoint for `feature_flags`, using the publishable key. That avoids loading `supabase-js` for anonymous visitors (spec 005, research R3).
- **Evaluation**: it happens in the browser. A flag is true when it is on, the visitor is in its audience (from the evaluation context's `role` and `signedIn`), and `fnv1a(flagKey + ':' + targetingKey) % 100 < rollout`. `targetingKey` is the user ID, or a random ID stored on the device for anonymous visitors.
- **Updates**: when `supabase-js` is already loaded (signed-in visitors), it subscribes to Realtime `postgres_changes` on `feature_flags` and emits `ConfigurationChanged`. Otherwise it fetches again every 5 minutes and when the tab regains focus.
- **Code** uses only `@openfeature/react-sdk` (`useFlag`, `useBooleanFlagValue`), never the provider directly.

## Consequences

- Admins manage flags in the same admin area as everything else, with the same audit log and role checks.
- There's no new service to run and no third-party cost or data sharing.
- Because flag settings are readable by anyone, flags must not contain secrets, and their keys and descriptions should be treated as public. Server-side checks that must not be bypassed, such as anything security-related, must not depend on a client-evaluated flag.
- Switching to flagd or a hosted provider later only means replacing the provider registration. Code that checks flags doesn't change.
