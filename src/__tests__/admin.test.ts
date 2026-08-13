import { describe, it, expect, beforeEach, vi } from "vitest";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { payments } from "../../src/db/schema";

describe("Admin Router", () => {
  beforeEach(async () => {
    await seedFixtures();
    const db = getDb();
    
    // Seed some payments so we can test revenue aggregation
    await db.insert(payments).values([
      { userId: 3, amountCents: 5000, method: "card", status: "paid", createdAt: "2026-01-01T10:00:00Z" },
      { userId: 4, amountCents: 15000, method: "cash", status: "paid", createdAt: "2026-01-02T10:00:00Z" },
      { userId: 3, amountCents: 1000, method: "card", status: "refunded", createdAt: "2026-01-03T10:00:00Z" },
      { userId: 4, amountCents: 2000, method: "card", status: "pending", createdAt: "2026-01-04T10:00:00Z" },
    ]);
  });

  describe("stats", () => {
    it("aggregates overall stats correctly", async () => {
      const caller = createCallerAs("admin", 1);
      const res = await caller.admin.stats();
      
      expect(res).toEqual({
        totalMembers: 2,
        activeMemberships: 2,
        upcomingClasses: 2,
        revenueCents: 20000, // 5000 + 15000
        totalCheckins: 0,
        pendingPayments: 1,
      });
    });
  });

  describe("revenueByMonth", () => {
    it("aggregates revenue by month", async () => {
      const caller = createCallerAs("admin", 1);
      const res = await caller.admin.revenueByMonth();
      
      expect(res).toHaveLength(1);
      expect(res[0]).toEqual({
        month: "2026-01",
        totalCents: 20000,
      });
    });
  });

  describe("revenueByMethod", () => {
    it("aggregates revenue by payment method", async () => {
      const caller = createCallerAs("admin", 1);
      const res = await caller.admin.revenueByMethod();
      
      const card = res.find((r: any) => r.method === "card");
      const cash = res.find((r: any) => r.method === "cash");
      
      expect(card?.totalCents).toBe(5000);
      expect(cash?.totalCents).toBe(15000);
    });
  });
});
