# Feature Specification: User Settings

**Feature Branch**: `005-user-settings`
**Created**: 2026-10-24
**Status**: Draft
**Input**: GitHub issue [Rymania/trips#7](https://github.com/Rymania/trips/issues/7): "The ability for users to manage their profile, including: user information, contact preferences, dark mode preferences, saved trips, family members."

## Context

The Family Day Planner MVP (spec 001) is anonymous. "Save for later" only lasts for the browser tab's session (`sessionStorage`), family size and ages are typed into the filters on every visit, and the theme always follows the operating system. Spec 001 deferred accounts to a later phase. This feature introduces optional accounts so families can keep their details, saved activities and preferences across visits and devices.

Browsing, searching and filtering MUST stay available without an account.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create an account and sign in (Priority: P1)

A parent who has found activities they like creates an account with their email address so their choices aren't lost. Later they sign in on their phone and pick up where they left off.

**Why this priority**: Every other story depends on knowing who the user is. On its own it also stops the activities a visitor saves from being lost when the tab closes.

**Independent Test**: Sign up with a new email, confirm the email, sign out, sign back in, and see the header show the signed-in state.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor, **When** they choose "Sign in" and enter their email, **Then** they receive a one-time sign-in link and code, and following either signs them in.
2. **Given** a visitor with no account, **When** they sign in with an email for the first time, **Then** an account and an empty profile are created for them.
3. **Given** a signed-in user, **When** they choose "Sign out", **Then** their session ends on this device and the app returns to the anonymous state without losing the current search.
4. **Given** an anonymous visitor who saved activities this session, **When** they sign in, **Then** those activities are added to their account's saved list without duplicates.
5. **Given** a sign-in link that has expired or was already used, **When** it is opened, **Then** the user sees a clear message and can request a new one.

---

### User Story 2 - Saved trips that persist (Priority: P1)

A signed-in parent saves activities from the detail dialog and later finds them all on a "Saved trips" page, on any device. They can add a planned date and a short note, and remove ones they no longer want.

**Why this priority**: Saving is already in the UI but forgets everything when the tab closes. It's the most visible gap and the main reason to sign in.

**Independent Test**: Sign in, save two activities, sign in on another browser, and see both on the Saved trips page. Remove one and confirm it's gone on both.

**Acceptance Scenarios**:

1. **Given** a signed-in user viewing an activity, **When** they choose "Save for later", **Then** it is stored on their account and the button shows "Saved".
2. **Given** a user with saved activities, **When** they open Saved trips, **Then** they see each one with its name, image, distance from their home location (if set) and any planned date and note, soonest planned date first, then most recently saved.
3. **Given** a saved activity, **When** the user sets a planned date or note, **Then** it is stored and shown on that item.
4. **Given** a saved activity that is no longer in any data source, **When** Saved trips loads, **Then** the item shows as "No longer available" with the name it had when saved, and can be removed.
5. **Given** an anonymous visitor, **When** they save an activity, **Then** it is kept for the session as today, and they see a prompt to sign in to keep it.

---

### User Story 3 - Family members (Priority: P2)

A parent adds the members of their family once (for example two adults, children born in 2017 and 2021, and the dog). The search then starts with the matching age groups, family size and dog-friendly filter already set. Each of these can still be changed for a single search.

**Why this priority**: It removes the most repetitive part of every visit and makes cost estimates accurate. It depends on US1.

**Independent Test**: Add members, open the search, and check that age groups, family size and dog-friendly match. Change a filter, and confirm the saved family hasn't changed.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they add a family member, **Then** they enter a nickname and a type (adult, child or dog), and for a child a birth month and year.
2. **Given** saved family members, **When** the user opens the search with no filters in the URL, **Then** the age groups match the children's current ages, the family size equals the number of people, and dog-friendly is on if a dog is listed.
3. **Given** a shared link with filters in the URL, **When** a signed-in user opens it, **Then** the link's filters win over the family defaults.
4. **Given** a child whose birthday moves them into a new age group, **When** the search loads, **Then** the new group is used with no action from the user.
5. **Given** a family member, **When** the user edits or removes them, **Then** the change is saved and used from the next search.

---

### User Story 4 - Profile information (Priority: P2)

A user sets the name shown in the app and a home location, so the search and distances start from home. They can change the email address they sign in with.

**Why this priority**: The home location saves a step on every visit. The rest is basic account housekeeping.

**Independent Test**: Set a display name and home location, reload, and see the name in the header and distances measured from home.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they set a display name of 1 to 50 characters, **Then** it is saved and shown in the account menu.
2. **Given** a signed-in user, **When** they set a home location using the existing location search, **Then** new searches default to it when no location is in the URL.
3. **Given** a signed-in user, **When** they change their email, **Then** the change only takes effect after they confirm it from the new address, and the old address is told about the change.
4. **Given** invalid input, such as an empty name or one that is too long, **When** they save, **Then** the field shows an error message and nothing is saved.

---

### User Story 5 - Theme preference (Priority: P3)

A user chooses Light, Dark or "Match my device" for the app's theme, and the choice follows them across devices.

**Why this priority**: The app already follows the device theme. This adds control, and it's small.

**Independent Test**: Choose Dark while the device is in light mode, reload, and sign in on another browser. The app is dark both times.

**Acceptance Scenarios**:

1. **Given** any visitor, **When** they choose a theme in the account menu or on the settings page, **Then** the app switches at once with no reload.
2. **Given** an anonymous visitor, **When** they choose a theme, **Then** it is remembered on this device.
3. **Given** a signed-in user, **When** they choose a theme, **Then** it is stored on their account and applied on any device they sign in on.
4. **Given** a stored theme, **When** the page loads, **Then** it is applied before first paint with no flash of the other theme.

---

### User Story 6 - Contact preferences (Priority: P3)

A user decides which emails they get from Trips: news about new features, and a digest of new activities near their home location. Every option is off until they turn it on.

**Why this priority**: The emails themselves come later. Recording consent now means the family can opt in when they sign up.

**Independent Test**: Turn on the digest, reload, and see it still on. Choose "unsubscribe" in an email and see it off in settings.

**Acceptance Scenarios**:

1. **Given** a new account, **When** the user opens contact preferences, **Then** every marketing option is off.
2. **Given** a user who opts in or out, **When** they save, **Then** the choice is stored with the time it was made.
3. **Given** a user who chose the digest, **When** they choose its frequency (weekly or monthly), **Then** it is stored.
4. **Given** any email that Trips sends, **When** the user follows its unsubscribe link, **Then** that option is turned off without having to sign in.

Emails Trips must send to run the account (sign-in links, email change confirmations) are not marketing and cannot be turned off.

---

### User Story 7 - Download or delete my data (Priority: P3)

A user downloads a copy of everything Trips holds about them, or deletes their account and all of it.

**Why this priority**: It's required under UK GDPR once personal data is stored, but it isn't part of everyday use.

**Independent Test**: Download the data and check it holds the profile, family, saved trips and preferences. Delete the account and confirm it can't sign in and its data is gone.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they choose "Download my data", **Then** they get a JSON file with their profile, family members, saved trips and preferences.
2. **Given** a signed-in user, **When** they choose "Delete my account" and confirm by typing their email, **Then** their account and all its data are permanently deleted and they are signed out.

---

### Edge Cases

- A user is signed in on two devices and edits the same saved trip on both. The last save wins, and each device shows the latest version the next time it loads.
- Signing in while offline, or while the account service is down: the user sees a clear error, the app keeps working anonymously, and nothing saved this session is lost.
- A saved activity ID that no data source returns any more (see US2 scenario 4).
- A child older than 17 counts in the family size but adds no age group, so they don't narrow the filters.
- A family with only a dog, or with no members, sets no age or size defaults.
- Several tabs: signing out in one tab signs out the others.
- Someone tries to sign in with an email that isn't theirs. The link only goes to that inbox, and repeated requests are rate-limited.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The app MUST keep all browsing, searching, filtering and detail views available without an account.
- **FR-002**: Users MUST be able to create an account and sign in with an email one-time link or code. There is no password.
- **FR-003**: The app MUST show the sign-in state and an account menu (Settings, Saved trips, Theme, Sign out) in the header on every page.
- **FR-004**: The app MUST provide a Settings page with sections for Profile, Family, Contact preferences, Appearance, and Your data. The page is only available when signed in.
- **FR-005**: The app MUST store saved trips (activity ID, the activity's name when saved, saved time, optional planned date, optional note of up to 500 characters) per account.
- **FR-006**: On sign-in, the app MUST merge the session's saved activities into the account.
- **FR-007**: The app MUST store family members (nickname of 1 to 30 characters, type of adult, child or dog, and birth month and year for children only). No full birth dates are stored.
- **FR-008**: The app MUST derive default filters (age groups, family size, dog-friendly) from the family when the URL has no filters. URL filters MUST always win.
- **FR-009**: The app MUST store a display name of 1 to 50 characters and an optional home location (place name and coordinates) per account, and use the home location as the default search location.
- **FR-010**: The app MUST store a theme preference of system, light or dark. When signed in it is stored per account, otherwise per device. It MUST be applied before first paint.
- **FR-011**: The app MUST store each marketing contact option as a separate opt-in that is off by default, with the time of the last change, and MUST support signed unsubscribe links.
- **FR-012**: Users MUST be able to export their data as JSON and to delete their account permanently.
- **FR-013**: Each user MUST only be able to read and change their own data. This MUST be enforced by the data store, not only in the app.
- **FR-014**: All new text in the interface MUST come from the i18n table. All new UI MUST use the Terra design tokens and meet WCAG 2.1 AA.

### Key Entities

- **Account**: the identity a person signs in with, identified by email. It is managed by the authentication service.
- **Profile**: one per account. Holds display name, home location, theme preference and timestamps.
- **Family Member**: belongs to a profile. Holds nickname, type (adult, child or dog), birth month and year for a child, and sort order.
- **Saved Trip**: belongs to a profile. Holds the activity reference, the activity's name when saved, saved time, optional planned date and optional note. Each activity can be saved once per profile.
- **Contact Preference**: belongs to a profile. Holds a topic (product news or nearby digest), whether it is on, the digest frequency, and when it was last changed.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A new visitor can create an account and be signed in within 60 seconds, including confirming their email.
- **SC-002**: Saved trips appear on a second device within 2 seconds of being saved, once that device loads or refreshes the page.
- **SC-003**: Users with a saved family need no filter changes before their first search on 80% of visits.
- **SC-004**: There is no flash of the wrong theme on load, and layout shift (CLS) stays at or below 0.1.
- **SC-005**: The main bundle stays at or below 150 KB gzipped. The settings page loads separately, on demand.
- **SC-006**: Automated tests show that one user can never read or change another user's data.

## Assumptions

- Sign-in is by email one-time link or code only. Social logins, such as Google and Apple, can be added later with the same accounts.
- A "saved trip" is a saved activity with an optional date and note. Named collections and multi-day itineraries stay out of scope, as in spec 001.
- Activity data still comes from the existing sources. Saved trips store only an activity reference and a copy of its name, not the activity data itself.
- Only one adult manages a family's account. Sharing a family between several accounts is out of scope.
- The emails themselves (the digest and product news) are a separate feature. This feature only records consent.
- The backend is Supabase (see [ADR 0001](../../docs/adr/0001-supabase-for-accounts.md)).
