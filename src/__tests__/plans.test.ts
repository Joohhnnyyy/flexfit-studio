import { describe, it, expect, beforeEach } from "vitest";
import { createCallerAs, seedFixtures } from "../../test/setup";

describe("Plans Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("list", () => {
    it("returns active membership plans by default", async () => {
      const caller = createCallerAs("member", 3);
      const res = await caller.plans.list();
      expect(res.length).toBeGreaterThan(0);
      expect(res.every((p) => p.active)).toBe(true);
    });
  });

  describe("subscribe", () => {
    it("allows a member to subscribe to a plan", async () => {
      const caller = createCallerAs("member", 3);
      // In seed fixtures, basic plan is id 1
      const res = await caller.plans.subscribe({ planId: 1, method: "card" });
      expect(res.status).toBe("active");
    });
  });

  describe("admin operations", () => {
    it("allows admin to create a plan", async () => {
      const caller = createCallerAs("admin", 1);
      const res = await caller.plans.create({
        name: "Pro Plan",
        priceCents: 10000,
        durationDays: 30,
        classCredits: 20,
      });
      expect(res.name).toBe("Pro Plan");
    });
  });
});
