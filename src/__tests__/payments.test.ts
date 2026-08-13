import { describe, it, expect, beforeEach } from "vitest";
import { sql, eq } from "drizzle-orm";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { TRPCError } from "@trpc/server";
import { payments, memberships } from "../../src/db/schema";

describe("Payments Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("mine & all", () => {
    it("returns user payments for mine and all payments for admin", async () => {
      const db = getDb();
      const caller = createCallerAs("member", 3);
      const adminCaller = createCallerAs("admin", 1);

      await db.insert(payments).values({
        id: 1,
        userId: 3,
        amountCents: 1000,
        method: "card",
        status: "pending",
        reference: "ref_1",
        createdAt: "2026-01-01T12:00:00Z"
      });

      const mine = await caller.payments.mine();
      expect(mine.length).toBe(1);
      expect(mine[0].amountCents).toBe(1000);

      const all = await adminCaller.payments.all({ limit: 10 });
      expect(all.length).toBe(1);
      expect(all[0].memberName).toBe("Member 1");
    });
  });

  describe("markPaid", () => {
    it("marks a pending payment as paid", async () => {
      const db = getDb();
      const adminCaller = createCallerAs("admin", 1);

      await db.insert(payments).values({
        id: 1,
        userId: 3,
        amountCents: 1000,
        method: "card",
        status: "pending",
        reference: "ref_1",
        createdAt: "2026-01-01T12:00:00Z"
      });

      const result = await adminCaller.payments.markPaid({ id: 1 });
      expect(result.status).toBe("paid");
    });

    it("rejects marking a refunded payment as paid", async () => {
      const db = getDb();
      const adminCaller = createCallerAs("admin", 1);

      await db.insert(payments).values({
        id: 1,
        userId: 3,
        amountCents: 1000,
        method: "card",
        status: "refunded",
        reference: "ref_1",
        createdAt: "2026-01-01T12:00:00Z"
      });

      await expect(adminCaller.payments.markPaid({ id: 1 })).rejects.toThrowError(
        new TRPCError({ code: "BAD_REQUEST", message: "Refunded payments cannot be marked paid." })
      );
    });
  });

  describe("refund", () => {
    it("refunds a paid payment and cancels associated membership", async () => {
      const db = getDb();
      const adminCaller = createCallerAs("admin", 1);

      await db.insert(payments).values({
        id: 1,
        userId: 3,
        membershipId: 1, // User 3's membership
        amountCents: 1000,
        method: "card",
        status: "paid",
        reference: "ref_1",
        createdAt: "2026-01-01T12:00:00Z"
      });

      const result = await adminCaller.payments.refund({ id: 1 });
      expect(result.status).toBe("refunded");

      const membership = await db.query.memberships.findFirst({
        where: eq(memberships.id, 1)
      });
      expect(membership?.status).toBe("cancelled");
    });

    it("rejects refunding a non-paid payment", async () => {
      const db = getDb();
      const adminCaller = createCallerAs("admin", 1);

      await db.insert(payments).values({
        id: 1,
        userId: 3,
        amountCents: 1000,
        method: "card",
        status: "pending",
        reference: "ref_1",
        createdAt: "2026-01-01T12:00:00Z"
      });

      await expect(adminCaller.payments.refund({ id: 1 })).rejects.toThrowError(
        new TRPCError({ code: "BAD_REQUEST", message: "Only paid payments can be refunded." })
      );
    });
  });
});
