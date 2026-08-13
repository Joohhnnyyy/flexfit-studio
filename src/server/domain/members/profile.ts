import { and, desc, eq, sql } from "drizzle-orm";
import { memberships, membershipPlans, bookings } from "@/db/schema";
import { type db as DatabaseType } from "@/db";

export async function getMemberProfile(
  database: typeof DatabaseType,
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: string;
  }
) {
  const membership = await database
    .select({
      id: memberships.id,
      status: memberships.status,
      startDate: memberships.startDate,
      endDate: memberships.endDate,
      creditsRemaining: memberships.creditsRemaining,
      planName: membershipPlans.name,
      planCredits: membershipPlans.classCredits,
    })
    .from(memberships)
    .innerJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
    .where(eq(memberships.userId, user.id))
    .orderBy(desc(memberships.endDate))
    .get();

  const [{ attended }] = await database
    .select({ attended: sql<number>`count(*)` })
    .from(bookings)
    .where(
      and(eq(bookings.userId, user.id), eq(bookings.status, "attended"))
    );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    membership: membership ?? null,
    classesAttended: Number(attended),
  };
}
