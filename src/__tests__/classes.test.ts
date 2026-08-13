import { describe, it, expect, beforeEach } from "vitest";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { TRPCError } from "@trpc/server";

describe("Classes Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("create", () => {
    it("allows staff to create a class", async () => {
      const caller = createCallerAs("admin", 1);
      const res = await caller.classes.create({
        name: "Pilates",
        room: "Studio C",
        capacity: 10,
        startsAt: "2026-02-01T10:00:00Z",
      });

      expect(res.name).toBe("Pilates");
      expect(res.capacity).toBe(10);
    });

    it("prevents members from creating classes", async () => {
      const caller = createCallerAs("member", 3);
      await expect(caller.classes.create({
        name: "Pilates",
        room: "Studio C",
        capacity: 10,
        startsAt: "2026-02-01T10:00:00Z",
      })).rejects.toThrowError(
        new TRPCError({ code: "FORBIDDEN", message: "Staff only." })
      );
    });
  });

  describe("update", () => {
    it("allows staff to update class details like assigning a trainer", async () => {
      const caller = createCallerAs("admin", 1);
      const res = await caller.classes.update({ id: 1, trainerId: 2, capacity: 20 });
      
      expect(res.trainerId).toBe(2);
      expect(res.capacity).toBe(20);
    });
  });

  describe("cancel", () => {
    it("cancels a class and also cancels all bookings for it", async () => {
      // First, book a member into class 1
      const memberCaller = createCallerAs("member", 3);
      await memberCaller.bookings.book({ classId: 1 });

      const adminCaller = createCallerAs("admin", 1);
      const res = await adminCaller.classes.cancel({ id: 1 });
      expect(res.cancelled).toBe(true);

      const db = getDb();
      const booking = await db.query.bookings.findFirst({ where: (b, { eq }) => eq(b.classId, 1) });
      expect(booking?.status).toBe("cancelled");
    });
  });
});
