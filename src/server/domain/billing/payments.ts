import { eq } from "drizzle-orm";
import { payments, memberships } from "@/db/schema";
import { type db as DatabaseType } from "@/db";

export async function processRefund(
  database: typeof DatabaseType,
  payment: typeof payments.$inferSelect
) {
  // Update the payment status
  const updated = await database
    .update(payments)
    .set({ status: "refunded" })
    .where(eq(payments.id, payment.id))
    .returning()
    .get();

  // Side-effect: If the payment was for a membership, cancel it
  if (payment.membershipId) {
    await database
      .update(memberships)
      .set({ status: "cancelled" })
      .where(eq(memberships.id, payment.membershipId));
  }

  return updated;
}
