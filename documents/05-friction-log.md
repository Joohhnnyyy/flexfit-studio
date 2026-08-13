# Developer Experience (DX) Friction Log

This document captures points of friction, confusing developer experiences (DX), and architectural hurdles encountered during the backend refactoring and frontend integration phases of the FlexFit Studio project. Documenting these issues provides a roadmap for future infrastructure, DX, and tooling improvements.

## 1. Test Teardown Fragility (Database Seed/Reset)
**The Friction:** The `seedFixtures` mechanism relies on manually ordered `DELETE FROM` statements to safely traverse and drop SQLite Foreign Key dependencies from leaves to roots.
**The Impact:** As domains were extracted and schema relationships modified (such as unifying `corporate-bookings`), keeping this teardown sequence accurate was highly manual and error-prone. A single missing relation causes constraint failures that break the entire characterization test suite.
**Proposed Solution:** Implement an automated teardown helper that either safely disables foreign key checks during truncation (`PRAGMA foreign_keys = OFF;`) or uses a dynamic script to determine the deletion graph automatically.

## 2. Orphaned Endpoints Masking Business Logic Bugs
**The Friction:** Several complex endpoints (like `reschedules.ts` and `payments.ts`) had extensive backend implementations but zero frontend UI integration.
**The Impact:** Because there was no way to manually click through these flows, severe logical bugs (such as the waitlist promotion failure when rescheduling out of a full class) remained hidden. Tests were passing because they were written against the flawed logic, but there was no visual feedback loop to catch the UX disconnect.
**Proposed Solution:** Enforce a "vertical slice" development standard. Backend endpoints should not be merged into `main` without at least a minimal UI implementation or an integration test suite that explicitly models full user workflows.

## 3. SQLite Concurrency & Next.js JIT Compilation
**The Friction:** Running the application locally using the Next.js dev server (`pnpm dev`) felt unusually laggy, leading to concerns about backend performance.
**The Impact:** Next.js uses Just-In-Time (JIT) compilation for routes. When combined with SQLite's default file-locking mechanism (requiring `fileParallelism: false` in tests), simultaneous client requests (e.g., rendering a dashboard while firing multiple TRPC queries) queue up and block. This gave the false impression that the application's architecture was slow, when in reality, the production build (`pnpm build && pnpm start`) is extremely fast.
**Proposed Solution:** Document the performance expectations clearly in the README. For future iterations, consider migrating to SQLite WAL (Write-Ahead Logging) mode or utilizing a local Postgres container (via Docker) to better mirror production concurrency limits.

## 4. Strict Next.js ESLint Blocking Builds
**The Friction:** Standard React patterns that work fine in development (like initializing `useState` inside `useEffect` after a TRPC fetch) were caught by strict Next.js ESLint rules (e.g., `react-hooks/set-state-in-effect`).
**The Impact:** What appeared to be a successful local development session resulted in a hard failure during the CI/production build step (since `next build` runs `next lint`). Fixing this required emergency component extractions just to get the production build to pass.
**Proposed Solution:** Ensure `pnpm run lint` is part of a standard pre-commit hook (e.g., using Husky and lint-staged) so that strict framework-specific errors are caught natively during development, rather than suddenly failing the production build pipeline.

## 5. Ambiguous UI Copy Impacting Perceived Logic
**The Friction:** The schedule UI originally displayed class capacity using the format `10 / 10 left`. 
**The Impact:** This wording was highly ambiguous. It was easily misread as "10 out of 10 people have booked" (meaning the class is full), rather than the intended "10 open spots remaining" (meaning the class is completely empty). This caused developer confusion when debugging the Waitlist and Corporate Booking logic, as it initially appeared the system was allowing bookings on full classes.
**Proposed Solution:** (Resolved) The UI copy was explicitly updated to `10 open spots` to prevent cognitive load and misinterpretation when evaluating system state.
