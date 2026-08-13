import { eq } from "drizzle-orm";
import { companies, memberships } from "@/db/schema";
import { UNLIMITED_CREDITS } from "@/server/routers/bookings";
import { type db } from "@/db";

export async function processRefund(
  database: typeof db,
  booking: { companyId: number | null; membershipId: number | null; creditsUsed: number }
) {
  if (booking.companyId) {
    const comp = await database
      .select()
      .from(companies)
      .where(eq(companies.id, booking.companyId))
      .get();
    
    if (comp) {
      await database
        .update(companies)
        .set({ creditPoolBalance: comp.creditPoolBalance + booking.creditsUsed })
        .where(eq(companies.id, comp.id));
    }
  } else if (booking.membershipId) {
    const ms = await database
      .select()
      .from(memberships)
      .where(eq(memberships.id, booking.membershipId))
      .get();

    if (ms && ms.creditsRemaining < UNLIMITED_CREDITS) {
      await database
        .update(memberships)
        .set({ creditsRemaining: ms.creditsRemaining + booking.creditsUsed })
        .where(eq(memberships.id, ms.id));
    }
  }
}
