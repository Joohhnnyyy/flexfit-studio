import { eq, and, asc } from "drizzle-orm";
import { bookings, companies, memberships, notifications, classes } from "@/db/schema";
import { UNLIMITED_CREDITS } from "@/server/routers/bookings";
import { type db } from "@/db";

export async function promoteWaitlist(
  database: typeof db,
  classId: number,
  creditCost: number
) {
  const next = await database
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.classId, classId),
        eq(bookings.status, "waitlisted"),
      ),
    )
    .orderBy(asc(bookings.bookedAt))
    .get();

  if (next) {
    await database
      .update(bookings)
      .set({ status: "booked", creditsUsed: creditCost })
      .where(eq(bookings.id, next.id));

    if (next.companyId) {
      const comp = await database
        .select()
        .from(companies)
        .where(eq(companies.id, next.companyId))
        .get();
      if (comp) {
        await database
          .update(companies)
          .set({ creditPoolBalance: Math.max(0, comp.creditPoolBalance - creditCost) })
          .where(eq(companies.id, comp.id));
      }
    } else if (next.membershipId) {
      const ms = await database
        .select()
        .from(memberships)
        .where(eq(memberships.id, next.membershipId))
        .get();

      if (ms && ms.creditsRemaining < UNLIMITED_CREDITS) {
        await database
          .update(memberships)
          .set({
            creditsRemaining: Math.max(
              0,
              ms.creditsRemaining - creditCost,
            ),
          })
          .where(eq(memberships.id, ms.id));
      }
    }

    const cls = await database
      .select({ name: classes.name })
      .from(classes)
      .where(eq(classes.id, classId))
      .get();

    if (cls) {
      await database.insert(notifications).values({
        userId: next.userId,
        type: "waitlist_promotion",
        title: "You've been promoted!",
        message: `You have been promoted from the waitlist to a confirmed spot for ${cls.name}.`,
      });
    }
  }
}
