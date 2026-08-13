# ADR 002: Unification of Individual and Corporate Bookings

## Status
Accepted

## Context
The application domain allows two types of class reservations:
1. **Individual Members:** Deduct from `memberships.creditsRemaining`
2. **Corporate Members:** Deduct from `companies.creditPoolBalance`

Currently, this is modeled as two entirely separate entities and flows: a `bookings` table and a `corporate_bookings` table, paired with separate `bookings.ts` and `corporate-bookings.ts` tRPC routers.
This structural separation creates severe logic duplication. Over 300 lines of complex business rules—including capacity checking, waitlist queue promotion, cancellation hour windows, and check-in counting—are meticulously copied and pasted across both models. 

## Alternatives Considered

### Alternative 1: Keep Separate Tables, Extract Shared Service Layer
- **Description:** Leave `bookings` and `corporate_bookings` as separate tables, but route their business logic through a shared domain service (e.g., `BookingManager.process()`).
- **Pros:** Does not require a database schema migration. Keeps queries explicitly separated.
- **Cons:** Any domain query spanning all attendees of a class requires a `UNION` across both tables (e.g. `rosterFor` has to pull from both places). We still have duplicated Drizzle schema definitions and duplicated foreign key structures.

### Alternative 2: Unified Bookings Table (Chosen)
- **Description:** Merge the tables. Add a nullable `companyId` to the `bookings` table to designate corporate reservations. Expose a single `bookings.book` endpoint with an explicit `useCompanyCredits?: boolean` flag to maintain exact behavioral parity with the old separated endpoints.
- **Pros:** A single source of truth for the class roster. Waitlist promotion operates on a single queue natively sorted by `bookedAt`. Complete elimination of duplicated routing logic and frontend client divergence.
- **Cons:** Requires a database migration step. Existing `corporate_bookings` rows must be translated over.

## Decision
We will unify the entities by dropping `corporate_bookings` and adding `companyId` to `bookings`. We are accepting the schema migration cost for a drastically simplified domain model.

### Data Migration Note
Because this application is currently in development without live production data, we are choosing *not* to write a complex SQL `INSERT INTO ... SELECT` migration script. Instead, we will drop the old table and update our local `src/db/seed.ts` development data to reflect the new unified structure.
