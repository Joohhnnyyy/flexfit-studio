import { describe, it, expect, beforeEach } from "vitest";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { checkins, bookings } from "../../src/db/schema";

describe("Members Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("profile", () => {
    it("returns active membership and checkin count", async () => {
      const db = getDb();
      // Add an attended booking for user 3
      await db.insert(bookings).values({ userId: 3, classId: 1, status: "attended", creditsUsed: 1, bookedAt: "2026-01-01T12:00:00Z" });
      
      const caller = createCallerAs("member", 3);
      const profile = await caller.members.profile();
      
      expect(profile.classesAttended).toBe(1);
      expect(profile.membership?.planName).toBe("Basic");
      expect(profile.membership?.creditsRemaining).toBe(5);
    });
  });

  describe("updateProfile", () => {
    it("updates user name and phone", async () => {
      const caller = createCallerAs("member", 3);
      const res = await caller.members.updateProfile({ name: "Updated Name", phone: "123-456-7890" });
      expect(res.name).toBe("Updated Name");
      expect(res.phone).toBe("123-456-7890");
    });
  });

  describe("search", () => {
    it("searches users by name or email", async () => {
      const caller = createCallerAs("trainer", 2); // staff procedure
      const res1 = await caller.members.search({ q: "Member" });
      expect(res1.length).toBeGreaterThan(0);
      expect(res1[0].name).toContain("Member");
      
      const res2 = await caller.members.search({ q: "nonexistent" });
      expect(res2.length).toBe(0);
    });
  });

  describe("byId", () => {
    it("returns user details with membership history", async () => {
      const caller = createCallerAs("trainer", 2); // staff procedure
      const res = await caller.members.byId({ id: 3 });
      
      expect(res.name).toBe("Member 1");
      expect(res.memberships.length).toBe(1);
      expect(res.memberships[0].planName).toBe("Basic");
    });
    
    it("throws if member not found", async () => {
      const caller = createCallerAs("trainer", 2);
      await expect(caller.members.byId({ id: 999 })).rejects.toThrowError(
        new TRPCError({ code: "NOT_FOUND", message: "Member not found." })
      );
    });
  });

  describe("admin operations", () => {
    it("allows admin to set active status", async () => {
      const adminCaller = createCallerAs("admin", 1);
      const res = await adminCaller.members.setActive({ id: 3, active: false });
      expect(res.active).toBe(false);
    });

    it("allows admin to set role", async () => {
      const adminCaller = createCallerAs("admin", 1);
      const res = await adminCaller.members.setRole({ id: 3, role: "trainer" });
      expect(res.role).toBe("trainer");
    });

    it("prevents trainers from setting role", async () => {
      const trainerCaller = createCallerAs("trainer", 2);
      await expect(trainerCaller.members.setRole({ id: 3, role: "trainer" })).rejects.toThrowError(
        new TRPCError({ code: "FORBIDDEN", message: "Admins only." })
      );
    });
  });

  describe("staff operations", () => {
    it("allows staff to lookup member by email", async () => {
      const trainerCaller = createCallerAs("trainer", 2);
      const res = await trainerCaller.members.lookupByEmailOrPhone({ query: "member1@flex.com" });
      expect(res.name).toBe("Member 1");
    });
  });
});
