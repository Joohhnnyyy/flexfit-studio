import { describe, it, expect, beforeEach } from "vitest";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { TRPCError } from "@trpc/server";

describe("Trainers Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("setAvailability", () => {
    it("allows trainer to set their availability", async () => {
      const caller = createCallerAs("trainer", 2);
      const res = await caller.trainers.setAvailability({
        dayOfWeek: 1, // Monday
        startTime: "09:00",
        endTime: "17:00",
      });

      expect(res.dayOfWeek).toBe(1);
      expect(res.startTime).toBe("09:00");
    });

    it("prevents members from setting availability", async () => {
      const caller = createCallerAs("member", 3);
      await expect(caller.trainers.setAvailability({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      })).rejects.toThrowError(
        new TRPCError({ code: "FORBIDDEN", message: "Only trainers can access this." })
      );
    });
  });

  describe("removeAvailability", () => {
    it("allows trainer to remove availability", async () => {
      const caller = createCallerAs("trainer", 2);
      await caller.trainers.setAvailability({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" });
      
      const res = await caller.trainers.removeAvailability({ dayOfWeek: 1 });
      expect(res.success).toBe(true);

      const db = getDb();
      const left = await db.query.trainerAvailability.findMany();
      expect(left.length).toBe(0);
    });
  });
});
