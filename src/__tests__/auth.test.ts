import { describe, it, expect, beforeEach } from "vitest";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { TRPCError } from "@trpc/server";

describe("Auth Router", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("me", () => {
    it("returns the current user", async () => {
      const caller = createCallerAs("member", 3);
      const res = await caller.auth.me();
      expect(res!.name).toBe("Test User");
      expect(res!.role).toBe("member");
    });
  });

  // Note: login/register/logout involve cookie setting/getting which might be 
  // difficult to mock purely in trpc callers here since the 'cookies' module 
  // from next/headers is used. In integration tests we'll verify behavior 
  // indirectly if needed, but for now we skip testing the cookie mutation directly.
});
