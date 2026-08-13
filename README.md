# FlexFit Studio

Class booking and membership management for a single gym site. Members book classes, buy memberships and spend class credits. Staff run the front desk, manage trainers and pull reports. Companies buy credit pools their employees book against.

## Requirements

Node 20 or newer, and pnpm. If you don't have pnpm:

```bash
npm install -g pnpm
```

The database is SQLite and lives in a file. There's no server to install and no account to create.

### Engineering Standards & Testing
This repository follows rigorous engineering practices. Before any refactoring, we employ **Characterization Testing** (via Vitest and tRPC callers) to freeze and snapshot the existing backend behavior, creating a golden safety net against regressions.

## Getting set up

```bash
cp .env.example .env.local
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

That gets you a populated studio at http://localhost:3000 with a couple of weeks of classes either side of today.

`db:push` creates `flexfit.db` and applies the schema. `db:seed` fills it with sample members, plans, classes and bookings.

## Signing in

| Role    | Email                  | Password   |
| ------- | ---------------------- | ---------- |
| Admin   | admin@flexfit.test     | admin123   |
| Trainer | arjun@flexfit.test     | trainer123 |
| Member  | rahul.k@example.com    | member123  |

Every seeded member uses `member123`. The other member emails are in `src/db/seed.ts`.

## Commands

| Command         | What it does                                      |
| --------------- | ------------------------------------------------- |
| `pnpm dev`      | Development server on port 3000                    |
| `pnpm build`    | Production build                                   |
| `pnpm db:push`  | Apply the schema in `src/db/schema.ts`             |
| `pnpm db:seed`  | Wipe the data and reseed                           |
| `pnpm db:reset` | Delete the database file, then push and seed again |

`db:reset` is the one you want when the data gets into a state you don't like. It's destructive and it's meant to be.

## Two things that will waste your time

Don't run `pnpm build` while `pnpm dev` is running. The build writes over the directory the dev server is using and the app starts throwing `MODULE_NOT_FOUND`. Nothing is actually broken. Stop the dev server, delete `.next`, start it again. If you want to typecheck while the server is up, use `npx tsc --noEmit` instead.

If you're changing anything in `src/db/schema.ts`, run `pnpm db:push` afterwards or the app and the database will disagree with each other in confusing ways.

## Layout

```
src/
  app/          routes and pages
  components/   shared components
  db/           schema, client, seed data
  lib/          helpers
  server/       tRPC routers and domain logic (`domain/`)
documents/      architecture documentation, behavior inventory, ADRs, etc.
```

## Recent Refactoring (Phases A-D)

We recently underwent a comprehensive architectural refactor of the backend to stabilize the system and decouple core business logic from the routing layer. For full reasoning and alternatives considered, please review our ADRs:
- [ADR-001: Folder Structure](documents/02-architecture-decisions/ADR-001-folder-structure.md)
- [ADR-002: Schema Unification](documents/02-architecture-decisions/ADR-002-schema-unification.md)
- [ADR-003: Unified Router Precedence](documents/02-architecture-decisions/ADR-003-unified-router-precedence.md)

### What Changed and Why
- **Domain Extraction & Bug Fixes:** We created a `src/server/domain/` layer to isolate pure business logic. This included extractions for `payments.ts` (protecting high-risk financial state), `members.ts` (profile and credit logic), `reports.ts`, and `reschedules.ts`. This abstraction allowed us to catch and fix hidden bugs—most notably in `reschedules.ts`, where a critical bug was silently failing to trigger waitlist promotions when a user rescheduled out of a full class. By extracting waitlist logic, reschedules now correctly free up slots and promote waitlisted members.
- **Schema Unification & Flag-Based Parity (`bookings.ts`):** We merged the redundant `corporate-bookings.ts` into `bookings.ts` to unify the client contracts. Instead of maintaining parallel schemas and endpoints for individual vs. corporate bookings, we rely on a single unified schema and introduced a strict `useCompanyCredits` flag. When provided, the server securely validates the user's company session data to authorize the action and applies corporate-specific rules (like a 24-hour free cancellation window instead of 12-hour).

### What Deliberately Didn't Change and Why
- **Simple CRUD Routers:** Routers like `classes.ts`, `auth.ts`, `plans.ts`, and `notifications.ts` were confirmed as pure CRUD during our behavior trace. They were explicitly left as-is without domain extraction because they already follow the "thin delegator" pattern.
- **Time-Dependent Logic Structure:** While we identified some deeply-coupled time logic (like checking `new Date()` inline), we did not aggressively refactor it out. We proved it is deterministically testable in our suite using Vitest's `vi.useFakeTimers()`.
- **Database Checking:** We noticed that the `classesAttended` metric relies on `bookings` with status `"attended"` rather than the actual `checkins` table. We kept this logic intact to preserve existing behavior and documented it as a quirk in [04-known-issues.md](documents/04-known-issues.md).

### Manual Smoke-Test Checklist
To verify the application behaves correctly post-refactor, you can run through this manual checklist:

- [ ] **Login**: Sign in as a member (`rahul.k@example.com` / `member123`).
- [ ] **Book a Class**: Navigate to the schedule and book an upcoming class. Verify your credits decrease by 1.
- [ ] **Cancel a Booking**: Cancel the booking you just made. Verify your credit is refunded.
- [ ] **Waitlist Promotion**: (Admin) Create a class with capacity 1. (Member 1) Book the class. (Member 2) Book the class and join the waitlist. (Member 1) Cancel the booking. Verify Member 2 is automatically promoted from the waitlist to booked.
- [ ] **Reschedule out of a full class**: (Member 1) Reschedule out of a full class to a different class. Verify the freed slot properly promotes the next waitlisted member.
- [ ] **Corporate Booking**: (Member 3 - Corporate) Book a class using the company credits toggle. Verify the company's credit pool (not personal credits) is charged, and that the cancellation window behaves as 24h instead of 12h.
- [ ] **Trainer Availability**: Sign in as a trainer (`arjun@flexfit.test` / `trainer123`). Attempt to set overlapping availability windows and verify the system catches the conflict.
- [ ] **Admin Reports**: Sign in as an admin (`admin@flexfit.test` / `admin123`) and verify the dashboard stats and revenue charts load without errors.
