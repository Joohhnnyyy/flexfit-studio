import { describe, it, expect, beforeEach } from "vitest";
import { sql, eq } from "drizzle-orm";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { TRPCError } from "@trpc/server";
import { classes, bookings, reschedules } from "../../src/db/schema";

describe("Reschedules Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("reschedule", () => {
    it("successfully reschedules to another class with the same name", async () => {
      const db = getDb();
      const caller = createCallerAs("member", 3);

      const booking = await caller.bookings.book({ classId: 1 });
      
      const [newClass] = await db.insert(classes).values({
        name: "Yoga",
        room: "Studio C",
        trainerId: 2,
        capacity: 10,
        startsAt: "2026-01-03T10:00:00Z",
        durationMin: 60,
        creditCost: 1,
        createdAt: "2026-01-01T12:00:00Z"
      }).returning();

      const result = await caller.reschedules.reschedule({
        fromBookingId: booking.id,
        toClassId: newClass.id,
      });

      expect(result.ok).toBe(true);
      expect(result.newStatus).toBe("booked");
      expect(result.newBooking.classId).toBe(newClass.id);
      expect(result.newBooking.creditsUsed).toBe(booking.creditsUsed);

      const oldBooking = await db.query.bookings.findFirst({
        where: eq(bookings.id, booking.id)
      });
      expect(oldBooking?.status).toBe("cancelled");

      const history = await db.query.reschedules.findFirst({
        where: eq(reschedules.fromBookingId, booking.id)
      });
      expect(history).toBeDefined();
    });

    it("fails if target class has a different name", async () => {
      const caller = createCallerAs("member", 3);
      const booking = await caller.bookings.book({ classId: 1 });

      await expect(
        caller.reschedules.reschedule({ fromBookingId: booking.id, toClassId: 2 })
      ).rejects.toThrowError(
        new TRPCError({ code: "BAD_REQUEST", message: "You can only reschedule to a class with the same name." })
      );
    });

    it("fails if within the 4 hour window", async () => {
      const db = getDb();
      const caller = createCallerAs("member", 3);

      const [closeClass] = await db.insert(classes).values({
        name: "Yoga",
        room: "Studio A",
        trainerId: 2,
        capacity: 10,
        startsAt: "2026-01-01T15:00:00Z",
        durationMin: 60,
        creditCost: 1,
        createdAt: "2026-01-01T12:00:00Z"
      }).returning();

      const [booking] = await db.insert(bookings).values({
        classId: closeClass.id,
        userId: 3,
        membershipId: 1,
        status: "booked",
        creditsUsed: 1,
      }).returning();

      await expect(
        caller.reschedules.reschedule({ fromBookingId: booking.id, toClassId: 1 })
      ).rejects.toThrowError(
        new TRPCError({ code: "BAD_REQUEST", message: "You can only reschedule up to 4 hours before the class starts." })
      );
    });
    
    it("waitlists if the target class is full", async () => {
      const db = getDb();
      const caller = createCallerAs("member", 3);

      const booking = await caller.bookings.book({ classId: 1 });
      
      const [fullClass] = await db.insert(classes).values({
        name: "Yoga",
        room: "Studio C",
        trainerId: 2,
        capacity: 0,
        startsAt: "2026-01-03T10:00:00Z",
        durationMin: 60,
        creditCost: 1,
        createdAt: "2026-01-01T12:00:00Z"
      }).returning();

      const result = await caller.reschedules.reschedule({
        fromBookingId: booking.id,
        toClassId: fullClass.id,
      });

      expect(result.ok).toBe(true);
      expect(result.newStatus).toBe("waitlisted");
      expect(result.newBooking.status).toBe("waitlisted");
    });
  });

  describe("history", () => {
    it("returns history of reschedules", async () => {
      const db = getDb();
      const caller = createCallerAs("member", 3);

      const booking = await caller.bookings.book({ classId: 1 });
      const [newClass] = await db.insert(classes).values({
        name: "Yoga",
        room: "Studio C",
        trainerId: 2,
        capacity: 10,
        startsAt: "2026-01-03T10:00:00Z",
        durationMin: 60,
        creditCost: 1,
        createdAt: "2026-01-01T12:00:00Z"
      }).returning();

      await caller.reschedules.reschedule({
        fromBookingId: booking.id,
        toClassId: newClass.id,
      });

      const history = await caller.reschedules.history();
      expect(history.length).toBe(1);
      expect(history[0].fromClassName).toBe("Yoga");
      expect(history[0].toClassName).toBe("Yoga");
    });
  });
});
