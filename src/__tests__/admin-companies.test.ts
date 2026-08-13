import { describe, it, expect, beforeEach } from "vitest";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { companies, companyMembers } from "../../src/db/schema";

describe("Admin Companies Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("create", () => {
    it("creates a new company", async () => {
      const admin = createCallerAs("admin", 1);
      const company = await admin.adminCompanies.create({
        name: "New Corp",
        contactEmail: "contact@newcorp.com",
        creditPoolBalance: 100,
      });

      expect(company.name).toBe("New Corp");
      expect(company.creditPoolBalance).toBe(100);
      expect(company.active).toBe(true);
    });

    it("rejects if not admin", async () => {
      const member = createCallerAs("member", 3);
      await expect(
        member.adminCompanies.create({
          name: "New Corp",
          contactEmail: "contact@newcorp.com",
        })
      ).rejects.toThrowError(
        new TRPCError({ code: "FORBIDDEN", message: "Admins only." })
      );
    });
  });

  describe("topUp", () => {
    it("adds credits to company pool", async () => {
      const admin = createCallerAs("admin", 1);
      // seedFixtures created company 1 with 100 credits
      const company = await admin.adminCompanies.topUp({ id: 1, amount: 25 });
      expect(company.creditPoolBalance).toBe(125);
    });

    it("fails for non-existent company", async () => {
      const admin = createCallerAs("admin", 1);
      await expect(admin.adminCompanies.topUp({ id: 999, amount: 25 })).rejects.toThrowError(
        new TRPCError({ code: "NOT_FOUND", message: "Company not found." })
      );
    });
  });

  describe("linkMember", () => {
    it("links a member to a company", async () => {
      const admin = createCallerAs("admin", 1);
      // User 4 is a member, not linked yet in seedFixtures
      const link = await admin.adminCompanies.linkMember({ companyId: 1, userId: 4 });
      expect(link.userId).toBe(4);
      expect(link.companyId).toBe(1);
    });

    it("fails if user is already linked", async () => {
      const admin = createCallerAs("admin", 1);
      // User 3 is already linked to company 1
      await expect(
        admin.adminCompanies.linkMember({ companyId: 1, userId: 3 })
      ).rejects.toThrowError(
        new TRPCError({ code: "CONFLICT", message: "This member is already linked to this company." })
      );
    });

    it("fails if user is not a member", async () => {
      const admin = createCallerAs("admin", 1);
      // User 2 is a trainer
      await expect(
        admin.adminCompanies.linkMember({ companyId: 1, userId: 2 })
      ).rejects.toThrowError(
        new TRPCError({ code: "BAD_REQUEST", message: "Only members can be linked to companies." })
      );
    });
  });

  describe("unlinkMember", () => {
    it("removes member link", async () => {
      const admin = createCallerAs("admin", 1);
      const db = getDb();
      const existing = await db.select().from(companyMembers).where(eq(companyMembers.userId, 3)).get();
      
      await admin.adminCompanies.unlinkMember({ companyMemberId: existing!.id });
      
      const check = await db.select().from(companyMembers).where(eq(companyMembers.id, existing!.id)).get();
      expect(check).toBeUndefined();
    });
  });

  describe("updateActive", () => {
    it("updates company active status", async () => {
      const admin = createCallerAs("admin", 1);
      const company = await admin.adminCompanies.updateActive({ id: 1, active: false });
      expect(company.active).toBe(false);
    });
  });
});
