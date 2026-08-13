import { beforeAll, afterAll, vi } from "vitest";
import { appRouter } from "../src/server/routers/_app";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../src/db/schema";
import { sql } from "drizzle-orm";
import { execSync } from "child_process";

let db: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof createClient>;

beforeAll(() => {
  // Trade-off: We use a single shared test.db with sequential execution (`fileParallelism: false`)
  // to avoid `SQLITE_BUSY` locks, chosen over complex per-file in-memory DB setups.
  process.env.TURSO_DATABASE_URL = "file:test.db";
  execSync("npx drizzle-kit push", { stdio: "ignore" });

  client = createClient({ url: process.env.TURSO_DATABASE_URL });
  db = drizzle(client, { schema });
  
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

export function getDb() {
  return db;
}

export function createCallerAs(role: "member" | "trainer" | "admin", userId: number, email = "test@test.com") {
  return appRouter.createCaller({
    db,
    user: { id: userId, email, passwordHash: "x", name: "Test User", phone: "1234567890", role, active: true, createdAt: "2026-01-01T00:00:00Z" },
    token: "fake-token"
  });
}

export async function seedFixtures() {
  // Trade-off: Hand-maintained FK delete order is used here to avoid constraints, 
  // chosen over trying to extract a schema-derived ordering. Will need maintenance if schema changes.
  await db.run(sql`DELETE FROM reschedules;`);
  await db.run(sql`DELETE FROM notifications;`);
  await db.run(sql`DELETE FROM sessions;`);
  await db.run(sql`DELETE FROM checkins;`);
  await db.run(sql`DELETE FROM payments;`);
  await db.run(sql`DELETE FROM company_members;`);
  await db.run(sql`DELETE FROM bookings;`);
  await db.run(sql`DELETE FROM trainer_availability;`);
  await db.run(sql`DELETE FROM classes;`);
  await db.run(sql`DELETE FROM memberships;`);
  await db.run(sql`DELETE FROM membership_plans;`);
  await db.run(sql`DELETE FROM companies;`);
  await db.run(sql`DELETE FROM users;`);
  
  await db.insert(schema.users).values([
    { id: 1, email: "admin@flex.com", passwordHash: "x", name: "Admin", role: "admin", createdAt: "2026-01-01T00:00:00Z" },
    { id: 2, email: "trainer@flex.com", passwordHash: "x", name: "Trainer", role: "trainer", createdAt: "2026-01-01T00:00:00Z" },
    { id: 3, email: "member1@flex.com", passwordHash: "x", name: "Member 1", role: "member", createdAt: "2026-01-01T00:00:00Z" },
    { id: 4, email: "member2@flex.com", passwordHash: "x", name: "Member 2", role: "member", createdAt: "2026-01-01T00:00:00Z" },
  ]);

  await db.insert(schema.membershipPlans).values([
    { id: 1, name: "Basic", priceCents: 5000, durationDays: 30, classCredits: 5 },
    { id: 2, name: "Unlimited", priceCents: 15000, durationDays: 30, classCredits: 999 },
  ]);

  await db.insert(schema.memberships).values([
    { id: 1, userId: 3, planId: 1, startDate: "2026-01-01T00:00:00Z", endDate: "2026-01-31T00:00:00Z", creditsRemaining: 5, status: "active", createdAt: "2026-01-01T00:00:00Z" },
    { id: 2, userId: 4, planId: 2, startDate: "2026-01-01T00:00:00Z", endDate: "2026-01-31T00:00:00Z", creditsRemaining: 999, status: "active", createdAt: "2026-01-01T00:00:00Z" },
  ]);

  await db.insert(schema.classes).values([
    { id: 1, name: "Yoga", room: "Studio A", trainerId: 2, capacity: 1, startsAt: "2026-01-02T10:00:00Z", durationMin: 60, creditCost: 1, createdAt: "2026-01-01T00:00:00Z" },
    { id: 2, name: "HIIT", room: "Studio B", trainerId: 2, capacity: 5, startsAt: "2026-01-05T10:00:00Z", durationMin: 45, creditCost: 1, createdAt: "2026-01-01T00:00:00Z" },
  ]);

  await db.insert(schema.companies).values([
    { id: 1, name: "Acme Corp", contactEmail: "hr@acme.com", creditPoolBalance: 100, createdAt: "2026-01-01T00:00:00Z" },
  ]);
  
  await db.insert(schema.companyMembers).values([
    { id: 1, userId: 3, companyId: 1, createdAt: "2026-01-01T00:00:00Z" }
  ]);
}
