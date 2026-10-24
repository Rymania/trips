# Feature Specification: Admin Settings

**Feature Branch**: `006-admin-settings`
**Created**: 2026-10-24
**Status**: Draft
**Input**: GitHub issue [Rymania/trips#8](https://github.com/Rymania/trips/issues/8). Add admin settings where owners of the application can:

- assign roles to users (admin, user)
- see admin settings only if they have the admin role
- manage user accounts (activate or deactivate, send email, edit details)
- use feature flags, set up with the OpenFeature framework
- view log-ins and user activity and trends
- set an app banner

**Depends on**: [005-user-settings](../005-user-settings/spec.md), which adds accounts, profiles and Supabase.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Roles and admin-only access (Priority: P1)

An owner of Trips signs in and sees an "Admin" entry in their account menu that ordinary users never see. From there they can make another user an admin, or take the admin role away.

**Why this priority**: Every other admin story depends on knowing who is an admin. Because admins can see other people's data, the restriction has to be enforced on the server.

**Independent Test**: Make one account admin using the setup command. That account sees and can open `/admin`. A normal account gets "not found" there, and its direct database or API calls to admin data are refused.

**Acceptance Scenarios**:

1. **Given** a new deployment with no admins, **When** the operator runs the documented setup command with an email address, **Then** that account becomes the first admin.
2. **Given** a signed-in user without the admin role, **When** they open `/admin` or call any admin function or table, **Then** they get a "not found" page in the app, and the server refuses the request.
3. **Given** an admin viewing a user, **When** they change that user's role between admin and user, **Then** the change is saved, recorded in the audit log, and takes effect on that user's next request.
4. **Given** only one admin exists, **When** anyone tries to remove that admin's role, **Then** the change is refused with "There must be at least one admin."
5. **Given** an admin, **When** they try to remove their own admin role, **Then** they must confirm first, and the last-admin rule still applies.

---

### User Story 2 - Manage user accounts (Priority: P1)

An admin finds a user by email or name. They view the account (status, role, sign-up date, last sign-in), correct the display name or email, deactivate the account if it's abusive or reactivate it, and send the user an email.

**Why this priority**: Support and safety tasks owners can't do any other way.

**Independent Test**: Search for a seeded user and edit their display name. Deactivate them and confirm they can't sign in, then reactivate and confirm they can. Send an email and see it arrive in Mailpit.

**Acceptance Scenarios**:

1. **Given** an admin on the Users page, **When** they search by part of an email or name, **Then** matching users are listed 25 per page with email, display name, role, status, created date and last sign-in.
2. **Given** an admin viewing a user, **When** they edit the display name or home location and save, **Then** the profile is updated and the change is recorded in the audit log.
3. **Given** an admin viewing a user, **When** they change the user's email, **Then** the new email takes effect, both the old and new addresses are told, and the change is recorded in the audit log.
4. **Given** an active user, **When** an admin deactivates them with a reason, **Then** the user can't sign in or refresh their session. Any session still open is refused for changes at once and ends within the access token's lifetime of at most 1 hour. The reason is recorded in the audit log.
5. **Given** a deactivated user, **When** an admin reactivates them, **Then** they can sign in again, and none of their data has been lost.
6. **Given** an admin viewing a user, **When** they send an email with a subject and a plain-text message, **Then** it's delivered to the user from the Trips support address and recorded in the audit log with the subject (not the body).
7. **Given** an admin, **When** they try to deactivate themselves, **Then** it is refused.

---

### User Story 3 - App banner (Priority: P2)

An admin publishes a short message shown across the top of every page, such as "Some London museums are closed on Monday 2 November." They choose its tone, an optional link and when it starts and ends.

**Why this priority**: It's simple and useful straight away for announcements and incidents.

**Independent Test**: Create a banner that starts now. An anonymous visitor sees it, can dismiss it, and it stays dismissed. After its end time it is gone.

**Acceptance Scenarios**:

1. **Given** an admin on the Banner page, **When** they enter a message of 1 to 280 characters, a tone (info, success or warning), an optional HTTPS link with its text, a start and an optional end, **Then** they see a preview using the real banner component before publishing.
2. **Given** a published banner inside its time window, **When** any visitor, signed in or not, loads any page, **Then** the banner shows above the header. Screen readers announce it, and it doesn't push down content that's already on screen.
3. **Given** a dismissible banner, **When** a visitor dismisses it, **Then** it stays hidden for that banner on that device. A new banner shows again.
4. **Given** a new banner is published, **When** an earlier one is still active, **Then** the earlier one is ended, so only one banner is active at a time.
5. **Given** banner text, **When** it is shown, **Then** it appears as plain text only, so HTML or script in it is never run.

---

### User Story 4 - Feature flags using OpenFeature (Priority: P2)

An admin turns features on or off without a release, for everyone or for a percentage of users, or only for signed-in users or admins. Developers check flags in the code through the OpenFeature SDK.

**Why this priority**: It makes it safe to release the rest of 005 and later features gradually.

**Independent Test**: Create the flag `saved-trips-notes`, set it on for admins only, and check that an admin sees notes on saved trips while a normal user doesn't. Change it to on for everyone at 50%, and roughly half of a set of test users see it, with the same answer every time for each user.

**Acceptance Scenarios**:

1. **Given** an admin on the Flags page, **When** they create a flag with a key (kebab-case, unique), a description, on or off, an audience (everyone, signed-in, or admins) and a rollout of 0–100%, **Then** it is saved and recorded in the audit log.
2. **Given** a component that checks a flag through the OpenFeature React SDK, **When** the flag's settings match the current visitor, **Then** it gets `true`, and otherwise the default value written in the code.
3. **Given** a rollout below 100%, **When** the same visitor checks the flag many times, including across reloads, **Then** they always get the same answer. Signed-in visitors are bucketed by user ID and anonymous visitors by a random ID stored on their device.
4. **Given** an admin changes a flag, **When** a signed-in visitor has the app open, **Then** the new value applies within 5 seconds without a reload. Anonymous visitors get it within 5 minutes or on their next page load.
5. **Given** flags can't be loaded, **When** the app checks a flag, **Then** it uses the code's default value and keeps working.

---

### User Story 5 - Sign-ins, activity and trends (Priority: P3)

An admin sees how Trips is being used: sign-ins over time, new sign-ups, active users, the most-saved activities and the most-searched categories. They can also see one user's recent sign-ins and activity when helping them.

**Why this priority**: It helps the owners make product decisions, but nothing else depends on it.

**Independent Test**: With seeded events, the Activity page shows the expected counts for the last 7, 30 and 90 days, and a user's detail page lists their sign-ins.

**Acceptance Scenarios**:

1. **Given** an admin on the Activity page, **When** they choose 7, 30 or 90 days, **Then** they see daily charts of sign-ins, sign-ups and active users, plus the top 10 saved activities and top 10 searched categories. Each chart has a table alternative.
2. **Given** an admin viewing a user, **When** they open the Activity tab, **Then** they see that user's last 50 sign-ins (time, method if recorded, and IP address partly hidden) and recent recorded actions.
3. **Given** a signed-in user doing something that is tracked (signing in, searching, viewing an activity, saving), **When** it happens, **Then** one event is recorded with no free text beyond the activity or category ID. Anonymous visitors are not tracked individually.
4. **Given** stored events, **When** they are older than the retention period, **Then** they are deleted automatically. Only the daily totals are kept.

---

### Edge Cases

- An admin's role is removed while they have the admin page open. Their next admin request is refused, and the app shows "You no longer have access".
- Two admins edit the same user at once. The last save wins, and both changes are recorded in the audit log.
- A deactivated user is still signed in on a device. Changes are refused at once, and the session ends within the token's lifetime.
- The email service is down when an admin sends an email. The admin sees "Not sent, try again", and nothing is recorded as sent.
- A banner whose end time is before its start time is refused when saving.
- A flag key used in code is deleted in the admin page. The code uses its default value.
- Searching users with SQL or HTML in the search box is treated as text.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST support the roles `admin` and `user`. Every account is a `user` unless given `admin`.
- **FR-002**: The system MUST enforce admin-only access on the server, in database policies and Edge Functions. Hiding the menu entry is not enough.
- **FR-003**: The system MUST refuse any change that would leave no admins.
- **FR-004**: The system MUST provide a documented, operator-only way to make the first admin.
- **FR-005**: Admins MUST be able to search, list (paginated), view and edit user details (display name, home location, email), deactivate and reactivate users, and email a user.
- **FR-006**: Deactivated users MUST NOT be able to sign in, refresh a session, or change any data.
- **FR-007**: Admins MUST be able to create, schedule, preview, publish, end and delete an app banner. At most one banner is active at a time, and it is shown as plain text.
- **FR-008**: The app MUST check feature flags only through the OpenFeature web and React SDKs, using a Trips provider backed by the flags admins manage.
- **FR-009**: Flags MUST support on or off, an audience (everyone, signed-in, admins) and a percentage rollout bucketed consistently per user.
- **FR-010**: The system MUST record sign-ins and a fixed set of activity events for signed-in users. Admins MUST be able to view totals over time and a single user's history.
- **FR-011**: Every admin action (role change, profile edit, email change, deactivation or reactivation, email sent, banner change, flag change) MUST be written to an audit log that admins can read and nobody can edit or delete.
- **FR-012**: The admin area MUST be a separate, lazily loaded part of the app that adds nothing to the main bundle for non-admins.
- **FR-013**: All admin interface text MUST come from the i18n table, and the admin pages MUST meet WCAG 2.1 AA, including table alternatives to charts.
- **FR-014**: Activity events MUST be deleted after [NEEDS CLARIFICATION: retention period. The proposal is 90 days for raw events and 13 months for sign-in history, with daily totals kept indefinitely].
- **FR-015**: Tracking signed-in users' activity MUST be described in the privacy notice. [NEEDS CLARIFICATION: is a privacy notice enough under legitimate interest, or do users need to opt in? The proposal is legitimate interest with an opt-out under Settings, then Contact & privacy.]
- **FR-016**: Admin emails MUST be sent through [NEEDS CLARIFICATION: email provider, the same one chosen for spec 005's sign-in emails. Resend is proposed].

### Key Entities

- **User Role**: an account and its role (`admin` or `user`), with who granted it and when.
- **Account Status**: whether an account is active or deactivated, the reason, and who changed it and when. It is stored on the profile.
- **App Banner**: message, tone, optional link, start and end times, whether it can be dismissed, and who created it.
- **Feature Flag**: key, description, on or off, audience, rollout percentage, and when and by whom it was last changed.
- **Activity Event**: an account, an event type (`sign_in`, `search`, `view_activity`, `save_activity`), an optional subject (activity or category ID) and a time.
- **Daily Activity Total**: day, event type, subject, count. Derived from events and kept after the events are deleted.
- **Audit Entry**: the admin who acted, the action, the target, details and the time. It can only be added to.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Automated tests show that a non-admin can't read or change any admin data, through any table or function.
- **SC-002**: An admin can find a user and deactivate them in under 30 seconds.
- **SC-003**: Flag changes reach signed-in visitors within 5 seconds and anonymous visitors within 5 minutes.
- **SC-004**: A banner published now is visible to new page loads within 1 minute.
- **SC-005**: The Activity page loads 90 days of totals in under 1 second for 10k users.
- **SC-006**: The main bundle for non-admin visitors grows by no more than 8 KB gzipped, for the banner and the OpenFeature SDK.
- **SC-007**: Every admin action in FR-011 creates exactly one audit entry. This is checked by tests.

## Assumptions

- There are two roles. Finer permissions, such as a "support" role that can't change roles, are out of scope but the design can be extended to them.
- Admin emails are one-off plain-text messages to a single user. Bulk email and templates are out of scope.
- Sign-in history comes from Supabase Auth's own audit records, so no extra sign-in tracking is needed.
- Flags are boolean. Multi-variant flags and A/B experiments are out of scope, although the OpenFeature provider can be extended to them later.
- Anonymous visitors are not tracked at all in this version, so trends describe signed-in users only. Counting anonymous totals (with no identifiers) could be added later, but it needs abuse protection on a public endpoint.
