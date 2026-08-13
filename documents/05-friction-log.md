# Developer Experience (DX) Friction Log

This document captures points of friction, confusing developer experiences (DX), and architectural hurdles encountered during the backend refactoring and frontend integration phases of the FlexFit Studio project. Documenting these issues provides a roadmap for future infrastructure, DX, and tooling improvements.

## 1. Test Teardown Fragility (Database Seed/Reset)
**The Friction:** The `seedFixtures` mechanism relies on manually ordered `DELETE FROM` statements to safely traverse and drop SQLite Foreign Key dependencies from leaves to roots.
**The Impact:** As domains were extracted and schema relationships modified (such as unifying `corporate-bookings`), keeping this teardown sequence accurate was highly manual and error-prone. A single missing relation causes constraint failures that break the entire characterization test suite.
**Proposed Solution:** Implement an automated teardown helper that either safely disables foreign key checks during truncation (`PRAGMA foreign_keys = OFF;`) or uses a dynamic script to determine the deletion graph automatically.

## 2. Orphaned Endpoints Masking Business Logic Bugs
**The Friction:** Several complex endpoints (like `reschedules.ts` and `payments.ts`) had extensive backend implementations but zero frontend UI integration.
**The Impact:** Because there was no UI, these endpoints were never manually exercised. The waitlist promotion bug inside `reschedules.ts` (where a user rescheduling out of a full class failed to promote the waitlist) was only discovered by us during Phase B characterization testing when we froze the backend behavior and realized the output was fundamentally wrong. Had there been a UI, a QA click-through or user report might have caught this much earlier.
**Proposed Solution:** Enforce a "vertical slice" development standard. Backend endpoints should not be merged into `main` without at least a minimal UI implementation or an integration test suite that explicitly models full user workflows.

## 3. Next.js JIT Compilation vs. Production Performance
**The Friction:** Running the application locally using the Next.js dev server (`pnpm dev`) felt unusually laggy, leading to initial concerns about backend or SQLite performance.
**The Impact:** Next.js uses Just-In-Time (JIT) compilation for routes in development. Every initial page load or TRPC route execution triggers compilation, causing 1-3 second delays on first render. This gave the false impression that the application's architecture was slow. In reality, once compiled for production (`pnpm build && pnpm start`), the server boots in ~200ms and page transitions/queries are near-instantaneous.
**Proposed Solution:** Document the performance expectations clearly in the README. Developers should periodically verify performance using the production build to ensure perceived lag is merely dev-mode JIT overhead and not an actual architectural bottleneck.

## 4. Strict Next.js ESLint Blocking Builds
**The Friction:** Standard React patterns that work fine in development (like initializing `useState` inside `useEffect` after a TRPC fetch) were caught by strict Next.js ESLint rules (e.g., `react-hooks/set-state-in-effect`).
**The Impact:** What appeared to be a successful local development session resulted in a hard failure during the CI/production build step (since `next build` runs `next lint`). Fixing this required emergency component extractions just to get the production build to pass.
**Proposed Solution:** Ensure `pnpm run lint` is part of a standard pre-commit hook (e.g., using Husky and lint-staged) so that strict framework-specific errors are caught natively during development, rather than suddenly failing the production build pipeline.

## 5. Ambiguous UI Copy Impacting Perceived Logic
**The Friction:** The schedule UI originally displayed class capacity using the format `10 / 10 left`. 
**The Impact:** This wording was highly ambiguous. It was easily misread as "10 out of 10 people have booked" (meaning the class is full), rather than the intended "10 open spots remaining" (meaning the class is completely empty). This caused developer confusion when debugging the Waitlist and Corporate Booking logic, as it initially appeared the system was allowing bookings on full classes.
**Proposed Solution:** (Resolved) The UI copy was explicitly updated to `10 open spots` to prevent cognitive load and misinterpretation when evaluating system state.
