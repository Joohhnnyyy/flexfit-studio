# Behavior Inventory

This document maps all user-facing actions across the backend routers.
It captures the *current* state of the application before refactoring.

*Note: For lower-risk administrative endpoints (`trainers.ts`, `classes.ts`), characterization and this trace are scoped to state-mutating actions (e.g., assigning trainers to classes). Read-only listings in these modules are excluded from explicit snapshot parity.*

*Note: Frontend Next.js authentication flows are explicitly out of scope for these characterization tests, which exercise the tRPC router logic securely beneath the web layer.*

## Router: `bookings.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Book Class | `book` | `classId` | Inserts booking (status: `booked`), decrements user credit. | `NOT_FOUND` (class missing)<br>`BAD_REQUEST` (cancelled/started)<br>`CONFLICT` (already booked)<br>`FORBIDDEN` (no membership/credits) | Waitlists if class capacity is full (`status: waitlisted`). Unlimited plans (999 credits) don't decrement. |
| Cancel Booking | `cancel` | `bookingId` | Success (refunds credits if > 12h before class) | `NOT_FOUND` (booking missing)<br>`FORBIDDEN` (wrong user)<br>`BAD_REQUEST` (already cancelled) | Waitlist promotion triggered if class was full. |
| Roster For | `rosterFor` | `classId` | List of attendees | `NOT_FOUND` | Admin only. |
| Mine | `mine` | (None) | List of user's bookings | `UNAUTHORIZED` | None |
| Mark Attended | `markAttended` | `bookingId`, `source` | Sets status to `attended`, inserts `checkin`. | `NOT_FOUND` (booking missing)<br>`BAD_REQUEST` (not in `booked` status) | Can be triggered via front desk or app kiosk. |

## Router: `corporate-bookings.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Book Class | `book` | `classId` | Success | `NOT_FOUND`, `CAPACITY_FULL`, `NOT_LINKED_TO_COMPANY`, `NO_COMPANY_CREDITS` | Same capacity/waitlist rules. Fails strictly if no company credits (no fallback to individual). |
| Cancel Booking | `cancel` | `bookingId` | Success (refunds company if > 24h before class) | `NOT_FOUND`, `FORBIDDEN` | 24h cancellation window (CORPORATE_FREE_CANCELLATION_HOURS) vs 12h for individual. Waitlist triggered. |
| Roster For | `rosterFor` | `classId` | Attendees (includes `companyName`) | `NOT_FOUND` | Admin only. Response shape includes companyName. |
| Mine | `mine` | (None) | User's bookings (includes `companyName`) | `UNAUTHORIZED` | Response shape includes companyName. |

## Router: `admin-companies.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Create Company | `create` | `name`, `contactEmail`, `creditPoolBalance` | Inserts a new company. | `FORBIDDEN` (not admin) | N/A |
| Top Up Credits | `topUp` | `id`, `amount` | Adds credits to company pool. | `NOT_FOUND`, `FORBIDDEN` | N/A |
| Update Active | `updateActive` | `id`, `active` | Toggles company active status. | `NOT_FOUND`, `FORBIDDEN` | N/A |
| Link Member | `linkMember` | `companyId`, `userId` | Links a user to a company. | `NOT_FOUND`, `CONFLICT` (already linked), `BAD_REQUEST` (user not a member), `FORBIDDEN` | N/A |
| Unlink Member | `unlinkMember` | `companyMemberId` | Removes member link. | `NOT_FOUND`, `FORBIDDEN` | N/A |

## Router: `reschedules.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Reschedule Booking | `reschedule` | `fromBookingId`, `toClassId` | Cancels old booking, creates new one (waitlists if target is full). | `NOT_FOUND` (booking or class missing), `FORBIDDEN` (wrong user), `BAD_REQUEST` (old class < 4h away, target class started/cancelled, target class diff name, old booking not active), `CONFLICT` (already booked target) | **Parallel Logic**: It transfers `creditsUsed` directly (no refund/deduct). **Bug/Oversight**: It manually marks the old booking `cancelled` but *fails* to trigger waitlist promotion for the freed slot on the old class. |
| Reschedule History | `history` | (None) | List of user's past reschedules with class details | `UNAUTHORIZED` | N/A |
| Validate Reschedule | `validateReschedule` | `fromBookingId`, `toClassId` | Dry run validation for UI. | Returns `{valid: false, reason: ...}` instead of throwing. | N/A |

## Router: `payments.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| My Payments | `mine` | (None) | User's payments with plan details. | `UNAUTHORIZED` | N/A |
| All Payments | `all` | `limit` (default 100) | All payments with member details. | `FORBIDDEN` (not admin) | N/A |
| Mark Paid | `markPaid` | `id` | Updates status to `paid`. | `NOT_FOUND`, `BAD_REQUEST` (already refunded), `FORBIDDEN` | Admin only. |
| Refund | `refund` | `id` | Updates status to `refunded`, and cancels associated membership. | `NOT_FOUND`, `BAD_REQUEST` (not paid), `FORBIDDEN` | Cancels membership if payment was for one. |

## Router: `members.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Profile Info | `profile` | (None) | Returns user profile, active membership status, and check-in count. | None | Calculates `classesAttended` by counting `bookings` with `status: "attended"`, **not** from the `checkins` table. |
| Admin Set Role | `setRole` | `id`, `role` | Updates user role to member, trainer, or admin. | `FORBIDDEN` (not admin) | N/A |

## Router: `admin.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Stats Dashboard | `stats` | (None) | Aggregates counts of members, memberships, classes, and sums `revenueCents`. | `FORBIDDEN` (not admin) | Pending vs Paid payments are segregated. |
| Revenue Report | `revenueByMonth` / `revenueByMethod` | (None) | Aggregates sum of `amountCents` grouped by month/method. | `FORBIDDEN` | Ignores refunded/pending payments. |

## Router: `trainers.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Set Avail. | `setAvailability` | `dayOfWeek`, `startTime`, `endTime` | Inserts or updates a trainer's availability window. | `FORBIDDEN` (not trainer) | N/A |
| Remove Avail. | `removeAvailability` | `dayOfWeek` | Deletes the availability record. | `FORBIDDEN` (not trainer) | Silently succeeds if no record existed. |

## Router: `classes.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Create Class | `create` | `name`, `room`, `capacity`, `startsAt` | Inserts a new class. | `FORBIDDEN` (not staff) | N/A |
| Update Class | `update` | `id`, `patch` | Updates class details (e.g. assigning trainer). | `NOT_FOUND` | N/A |
| Cancel Class | `cancel` | `id` | Flags class as cancelled, sets all related bookings to `cancelled`. | `NOT_FOUND`, `FORBIDDEN` (not admin) | Mass-cancels bookings but does *not* refund credits (requires a manual refund job). |

## Router: `auth.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Get User | `me` | (None) | Returns current logged in user | None | Public procedure, returns undefined if not logged in. |
| Login | `login` | `email`, `password` | Returns user info and sets session cookie | `UNAUTHORIZED` (wrong credentials), `FORBIDDEN` (deactivated) | Sets `SESSION_COOKIE` with 30-day expiry. |
| Register | `register` | `email`, `password`, `name`, `phone` | Returns created user info | `CONFLICT` (email exists) | Hashes password, assigns `member` role. |
| Logout | `logout` | (None) | Returns success and clears cookie | None | Deletes session from DB and clears cookie. |

## Router: `plans.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| List Plans | `list` | `includeInactive` | Returns membership plans | None | Public procedure, filters out inactive plans by default. |
| Subscribe | `subscribe` | `planId`, `method` | Returns new active membership | `NOT_FOUND`, `BAD_REQUEST` (inactive plan) | Inserts membership and a 'paid' payment record. Starts today. |
| Create Plan | `create` | `name`, `priceCents`, `durationDays`, `classCredits` | Returns created plan | `FORBIDDEN` (not admin) | N/A |
| Set Active | `setActive` | `id`, `active` | Updates active status | `FORBIDDEN` (not admin) | N/A |

## Router: `notifications.ts`

| Feature | Trigger | Inputs | Expected Output | Error Cases | Edge Cases |
|---------|---------|--------|-----------------|-------------|------------|
| Unread Count | `unreadCount` | (None) | Returns count of unread notifications | `UNAUTHORIZED` | N/A |
| List | `list` | `limit` | Returns user's notifications | `UNAUTHORIZED` | Ordered by newest first. |
| Mark Read | `markAllAsRead` | (None) | Marks all as read | `UNAUTHORIZED` | N/A |
| Broadcast | `broadcast` | `title`, `message` | Inserts announcement for all members | `FORBIDDEN` (not admin) | Skips if no active members found. |
