# ADR 001: Feature-Sliced Folder Structure and Domain Consolidation

## Status
Accepted

## Context
During Phase A (Characterization Testing), we traced the existing application behavior and analyzed the database schema dependency graph. The current architecture organizes code technically (e.g., all tRPC routers in `src/server/routers/`), resulting in massive files (`bookings.ts` and `corporate-bookings.ts` are >300 lines each) and severe logic duplication. 

Our foreign key teardown sequence highlighted clear domain boundaries:
1. **Core / Identity:** `users`, `sessions`, `companies`, `companyMembers`
2. **Catalog / Scheduling:** `membershipPlans`, `trainerAvailability`, `classes`
3. **Fulfillment / Operations:** `memberships`, `bookings`, `corporateBookings`, `reschedules`, `checkins`
4. **Finance / Comms:** `payments`, `notifications`

Additionally, ponytail-review auditing revealed that the separation of individual vs. corporate bookings is an artificial boundary causing massive over-engineering.

## Decision
We will migrate from a flat, technical folder structure to a **Feature-Sliced (Domain-Driven)** folder structure within `src/server/`. We will also consolidate duplicated tables and routers.

### 1. Target Folder Structure
```text
src/server/
├── domain/
│   ├── auth/            # Users, sessions, roles
│   ├── scheduling/      # Classes, trainer availability
│   ├── bookings/        # Bookings, checkins, reschedules
│   ├── billing/         # Memberships, companies, payments, revenue
│   └── notifications/   # System alerts
├── routers/             # (Thin wrappers that call domain services)
├── db/                  # (Centralized database infrastructure and schema.ts)
```

### 2. Refactoring Targets (Duplicated Logic)
Based on real code traces, the following 4 areas of duplicated/tangled logic will be extracted or merged:
1. **Unified Bookings Router & Table:** Merge `corporate-bookings.ts` into `bookings.ts`, and `corporate_bookings` table into `bookings` (adding a nullable `companyId`). The reservation flow is identical.
2. **Waitlist Promotion:** The waitlist promotion logic is manually duplicated inside the `cancel` mutation of both booking routers. This will be extracted to a shared `promoteWaitlist(classId)` domain service.
3. **Cancellation Window Math:** The `hoursUntil(cls.startsAt) >= FREE_CANCELLATION_HOURS` check and refund execution is duplicated. It will be moved to a shared `refundBooking()` service.
4. **Dashboard Aggregations:** The `admin.ts` router has inline raw SQL for revenue and stats aggregations. This will be isolated into a `billing` reporting service.

## Consequences
- **Positive:** Eliminates ~300+ lines of duplicated code immediately (Corporate Bookings). 
- **Positive:** Domain logic (like waitlist promotion) becomes unit-testable outside of the tRPC router context.
- **Negative:** Requires careful, incremental refactoring steps (Phase B) so we don't break the characterization test safety net. Tests will need to be updated to point to the new domain services or unified routers.
