import { describe, it, expect, beforeEach, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { TRPCError } from "@trpc/server";
import { companyMembers, classes } from "../../src/db/schema";

describe("Bookings Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("book", () => {
    it("books a class successfully and decrements credits", async () => {
      const caller = createCallerAs("member", 3); // member1 (has 5 credits)
      const res = await caller.bookings.book({ classId: 1 });
      
      expect(res.status).toBe("booked");
      expect(res.creditsUsed).toBe(1);

      const db = getDb();
      const membership = await db.query.memberships.findFirst({ where: (m, { eq }) => eq(m.id, 1) });
      expect(membership?.creditsRemaining).toBe(4);
    });

    it("rejects booking if class is cancelled", async () => {
      const db = getDb();
      await db.run(sql`UPDATE classes SET cancelled = 1 WHERE id = 1`);
      
      const caller = createCallerAs("member", 3);
      await expect(caller.bookings.book({ classId: 1 })).rejects.toThrowError(
        new TRPCError({ code: "BAD_REQUEST", message: "This class has been cancelled." })
      );
    });

    it("waitlists when class is full", async () => {
      const caller1 = createCallerAs("member", 3); // member1
      const caller2 = createCallerAs("member", 4); // member2 (unlimited)

      await caller1.bookings.book({ classId: 1 }); // Capacity is 1, so this fills it
      
      const res = await caller2.bookings.book({ classId: 1 }); // This should waitlist
      expect(res.status).toBe("waitlisted");
      expect(res.creditsUsed).toBe(0);

      // Verify unlimited credits weren't decremented anyway (though cost is 0 so it's fine)
      const db = getDb();
      const m2 = await db.query.memberships.findFirst({ where: (m, { eq }) => eq(m.id, 2) });
      expect(m2?.creditsRemaining).toBe(999);
    });

    it("prevents double-booking", async () => {
      const caller = createCallerAs("member", 3);
      await caller.bookings.book({ classId: 1 });
      
      await expect(caller.bookings.book({ classId: 1 })).rejects.toThrowError(
        new TRPCError({ code: "CONFLICT", message: "You are already on the list for this class." })
      );
    });
  });

  describe("cancel", () => {
    it("cancels booking and refunds credits if outside FREE_CANCELLATION_HOURS", async () => {
      const caller = createCallerAs("member", 3);
      const booking = await caller.bookings.book({ classId: 1 }); // class1 starts 2026-01-02T10:00:00Z, now is 2026-01-01T12:00:00Z (22 hours ahead)
      
      const res = await caller.bookings.cancel({ bookingId: booking.id });
      expect(res.refunded).toBe(true);

      const db = getDb();
      const membership = await db.query.memberships.findFirst({ where: (m, { eq }) => eq(m.id, 1) });
      expect(membership?.creditsRemaining).toBe(5); // Refunded 1 credit
    });

    it("cancels but does not refund if inside FREE_CANCELLATION_HOURS", async () => {
      const caller = createCallerAs("member", 3);
      const booking = await caller.bookings.book({ classId: 1 }); 
      
      // Advance time to 2 hours before class
      vi.setSystemTime(new Date("2026-01-02T08:00:00Z"));
      
      const res = await caller.bookings.cancel({ bookingId: booking.id });
      expect(res.refunded).toBe(false);

      const db = getDb();
      const membership = await db.query.memberships.findFirst({ where: (m, { eq }) => eq(m.id, 1) });
      expect(membership?.creditsRemaining).toBe(4); // Did not refund
      
      // Reset time back for other tests
      vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    });

    it("promotes waitlisted member when a spot opens", async () => {
      const caller1 = createCallerAs("member", 3);
      const caller2 = createCallerAs("member", 4);

      const booking1 = await caller1.bookings.book({ classId: 1 }); // fills class
      const booking2 = await caller2.bookings.book({ classId: 1 }); // waitlisted
      expect(booking2.status).toBe("waitlisted");

      await caller1.bookings.cancel({ bookingId: booking1.id }); // caller1 cancels

      const db = getDb();
      const b2 = await db.query.bookings.findFirst({ where: (b, { eq }) => eq(b.id, booking2.id) });
      expect(b2?.status).toBe("booked");
      expect(b2?.creditsUsed).toBe(1); // caller2 was unlimited, but cost is recorded
    });

    it("prevents non-owners from cancelling unless staff", async () => {
      const caller1 = createCallerAs("member", 3);
      const booking1 = await caller1.bookings.book({ classId: 1 });

      const caller2 = createCallerAs("member", 4);
      await expect(caller2.bookings.cancel({ bookingId: booking1.id })).rejects.toThrowError(
        new TRPCError({ code: "FORBIDDEN", message: "You cannot cancel this booking." })
      );

      const adminCaller = createCallerAs("admin", 1);
      const res = await adminCaller.bookings.cancel({ bookingId: booking1.id });
      expect(res.ok).toBe(true);
    });
  });

  describe("corporate bookings logic", () => {
    it("books a class successfully using company credits", async () => {
      const caller = createCallerAs("member", 3); // member1 is in Acme Corp (100 credits)
      const res = await caller.bookings.book({ classId: 1, useCompanyCredits: true });
      
      expect(res.status).toBe("booked");
      expect(res.creditsUsed).toBe(1);

      const db = getDb();
      const company = await db.query.companies.findFirst({ where: (c, { eq }) => eq(c.id, 1) });
      expect(company?.creditPoolBalance).toBe(99);
    });

    it("waitlists when class is full and does not charge company", async () => {
      const caller1 = createCallerAs("member", 3); // member1 (in Acme Corp)
      await caller1.bookings.book({ classId: 1, useCompanyCredits: true }); // Capacity is 1, so this fills it
      
      // Need a second member in Acme Corp to waitlist. We only have one in fixture, so let's add one.
      const db = getDb();
      await db.insert(companyMembers).values({
        userId: 4, companyId: 1, createdAt: "2026-01-01T00:00:00Z"
      });

      const caller2 = createCallerAs("member", 4);
      const res = await caller2.bookings.book({ classId: 1, useCompanyCredits: true });
      
      expect(res.status).toBe("waitlisted");
      expect(res.creditsUsed).toBe(0);

      const company = await db.query.companies.findFirst({ where: (c, { eq }) => eq(c.id, 1) });
      expect(company?.creditPoolBalance).toBe(99); // Only charged for caller1
    });

    it("cancels booking and refunds company credits if outside CORPORATE_FREE_CANCELLATION_HOURS (24)", async () => {
      const caller = createCallerAs("member", 3);
      const booking = await caller.bookings.book({ classId: 1, useCompanyCredits: true }); // class1 starts 2026-01-02T10:00:00Z, now is 2026-01-01T12:00:00Z (22 hours ahead)
      
      // Since corporate window is 24 hours, and we are 22 hours ahead, it should NOT refund!
      const res = await caller.bookings.cancel({ bookingId: booking.id });
      expect(res.refunded).toBe(false);

      const db = getDb();
      const company = await db.query.companies.findFirst({ where: (c, { eq }) => eq(c.id, 1) });
      expect(company?.creditPoolBalance).toBe(99); // Did not refund
    });

    it("cancels and refunds company credits if >24h ahead", async () => {
      const caller = createCallerAs("member", 3);
      // Create a class 48h ahead
      const db = getDb();
      await db.insert(classes).values({
        id: 99, name: "Future", room: "A", trainerId: 2, capacity: 1, startsAt: "2026-01-05T12:00:00Z", durationMin: 60, creditCost: 1, createdAt: "2026-01-01T00:00:00Z"
      });

      const booking = await caller.bookings.book({ classId: 99, useCompanyCredits: true });
      const companyBefore = await db.query.companies.findFirst({ where: (c, { eq }) => eq(c.id, 1) });
      expect(companyBefore?.creditPoolBalance).toBe(99);
      
      const res = await caller.bookings.cancel({ bookingId: booking.id });
      expect(res.refunded).toBe(true);

      const companyAfter = await db.query.companies.findFirst({ where: (c, { eq }) => eq(c.id, 1) });
      expect(companyAfter?.creditPoolBalance).toBe(100);
    });
  });
});
