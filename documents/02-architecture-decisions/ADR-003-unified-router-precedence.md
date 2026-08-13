# ADR 003: Unified Router Precedence and Security Boundaries

## Status
Accepted

## Context
When merging the `bookings` and `corporate_bookings` tables (as decided in ADR-002), we must also unify the tRPC router logic. 

The original codebase had two distinct endpoints:
- `bookings.book`: Charged individual membership credits.
- `corporateBookings.book`: Charged the company pool and strictly failed (`FORBIDDEN`) if the pool was empty, even if the user had individual credits.

Unifying these endpoints requires deciding how precedence works when a user is linked to a company but wants to book a class.

## Alternatives Considered

### Alternative 1: Synthesized Fallback (Rejected)
- **Description:** The unified `book` endpoint automatically checks individual credits, and if empty, falls back to the company pool (or vice versa).
- **Why it was rejected:** This introduces *new* business behavior that never existed. In the old model, the user explicitly chose the corporate endpoint. Automatically falling back could lead to unintended charges (e.g. accidentally draining the corporate pool for a personal booking), violating the strict behavior parity required by characterization testing.

### Alternative 2: Flag-based Client Selection with Server Validation (Chosen)
- **Description:** The new unified `bookings.book` endpoint accepts an explicit flag: `useCompanyCredits?: boolean`. The client passes `true` to emulate the old `corporateBookings.book` flow, or `false` (default) to use individual credits.
- **Security Check:** Because the flag is a client-controlled trust boundary, the server *must* independently validate it. If `useCompanyCredits: true` is passed, the server must query the database to verify the requesting `ctx.user.id` is actually linked to a company (`companyMembers` relation), and throw `FORBIDDEN` if they are not, before charging any pool.

## Decision
We will use the **Flag-based (Alternative 2)** approach to ensure strict behavioral parity without synthesizing new fallback logic. This preserves the explicit user intent from the old split-router model while operating on a single unified table. We will strictly validate the trust boundary server-side to prevent privilege escalation.
