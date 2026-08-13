import { describe, it, expect, beforeEach } from "vitest";
import { createCallerAs, seedFixtures, getDb } from "../../test/setup";
import { notifications } from "../../src/db/schema";
import { eq } from "drizzle-orm";

describe("Notifications Router", () => {
  beforeEach(async () => {
    await seedFixtures();
    const db = getDb();
    await db.insert(notifications).values({
      userId: 3,
      type: "waitlist_promotion",
      title: "Booking Confirmed",
      message: "You are booked.",
      read: false,
    });
  });

  describe("unreadCount", () => {
    it("returns correct count of unread notifications", async () => {
      const caller = createCallerAs("member", 3);
      const count = await caller.notifications.unreadCount();
      expect(count).toBe(1);
    });
  });

  describe("list", () => {
    it("returns notifications for user", async () => {
      const caller = createCallerAs("member", 3);
      const list = await caller.notifications.list();
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].title).toBe("Booking Confirmed");
    });
  });

  describe("markAllAsRead", () => {
    it("marks all unread as read", async () => {
      const caller = createCallerAs("member", 3);
      await caller.notifications.markAllAsRead();
      const count = await caller.notifications.unreadCount();
      expect(count).toBe(0);
    });
  });

  describe("broadcast", () => {
    it("allows admin to broadcast to all members", async () => {
      const caller = createCallerAs("admin", 1);
      const res = await caller.notifications.broadcast({
        title: "Hello",
        message: "Everyone",
      });
      expect(res.ok).toBe(true);
      expect(res.count).toBeGreaterThan(0);

      // Check if member 3 got it
      const db = getDb();
      const member3Notifs = await db.query.notifications.findMany({
        where: eq(notifications.userId, 3),
      });
      const broadcastNotif = member3Notifs.find(n => n.title === "Hello");
      expect(broadcastNotif).toBeDefined();
    });
  });
});
