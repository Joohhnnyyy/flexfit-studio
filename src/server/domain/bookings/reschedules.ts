import { and, eq, sql } from "drizzle-orm";
import { bookings, classes, reschedules } from "@/db/schema";
import { type db as DatabaseType } from "@/db";
import { promoteWaitlist } from "./waitlist";

export const FREE_RESCHEDULE_HOURS = 4;

export function hoursUntil(iso: string, now = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 36e5;
}

export type RescheduleValidationResult =
  | { valid: false; reason: string }
  | {
      valid: true;
      targetClass: typeof classes.$inferSelect;
      targetIsFull: boolean;
    };

export async function validateRescheduleRequest(
  database: typeof DatabaseType,
  userId: number,
  originalBooking: typeof bookings.$inferSelect,
  originalClass: typeof classes.$inferSelect,
  targetClassId: number,
  now = new Date()
): Promise<RescheduleValidationResult> {
  // Verify ownership
  if (originalBooking.userId !== userId) {
    return { valid: false, reason: "You cannot reschedule this booking." };
  }

  // Verify booking is still active
  if (
    originalBooking.status !== "booked" &&
    originalBooking.status !== "waitlisted"
  ) {
    return { valid: false, reason: "This booking is no longer active." };
  }

  // Verify reschedule is allowed (within window)
  const hoursBeforeOriginal = hoursUntil(originalClass.startsAt, now);
  if (hoursBeforeOriginal < FREE_RESCHEDULE_HOURS) {
    return {
      valid: false,
      reason: `You can only reschedule up to ${FREE_RESCHEDULE_HOURS} hours before the class starts.`,
    };
  }

  // Get target class
  const targetClass = await database
    .select()
    .from(classes)
    .where(eq(classes.id, targetClassId))
    .get();

  if (!targetClass) {
    return { valid: false, reason: "Target class not found." };
  }

  // Verify target class has the same name
  if (targetClass.name !== originalClass.name) {
    return {
      valid: false,
      reason: "You can only reschedule to a class with the same name.",
    };
  }

  // Verify target class is not the same class
  if (targetClass.id === originalClass.id) {
    return { valid: false, reason: "You are already booked for this class." };
  }

  // Verify target class hasn't started
  if (hoursUntil(targetClass.startsAt, now) <= 0) {
    return { valid: false, reason: "This class has already started." };
  }

  // Verify target class is not cancelled
  if (targetClass.cancelled) {
    return { valid: false, reason: "This class has been cancelled." };
  }

  // Check if user already has an active booking for this class
  const existingBooking = await database
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.classId, targetClass.id),
        eq(bookings.userId, userId),
        sql`${bookings.status} in ('booked', 'waitlisted')`
      )
    )
    .get();

  if (existingBooking) {
    return {
      valid: false,
      reason: "You already have an active booking for this class.",
    };
  }

  // Check if target class is full
  const [{ count }] = await database
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(
      and(
        eq(bookings.classId, targetClass.id),
        eq(bookings.status, "booked")
      )
    );

  const targetIsFull = Number(count) >= targetClass.capacity;

  return {
    valid: true,
    targetClass,
    targetIsFull,
  };
}

export async function processReschedule(
  database: typeof DatabaseType,
  userId: number,
  originalBooking: typeof bookings.$inferSelect,
  originalClass: typeof classes.$inferSelect,
  targetClass: typeof classes.$inferSelect,
  targetIsFull: boolean,
  now = new Date()
) {
  // Create the new booking (transfer credits directly, parallel logic)
  const newBooking = await database
    .insert(bookings)
    .values({
      classId: targetClass.id,
      userId: userId,
      membershipId: originalBooking.membershipId,
      companyId: originalBooking.companyId,
      status: targetIsFull ? "waitlisted" : "booked",
      creditsUsed: originalBooking.creditsUsed,
    })
    .returning()
    .get();

  // Cancel the original booking
  await database
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledAt: now.toISOString(),
    })
    .where(eq(bookings.id, originalBooking.id));

  // Fix Oversight: Promote waitlist for the old class since a spot opened up
  if (originalBooking.status === "booked") {
    await promoteWaitlist(database, originalClass.id, originalClass.creditCost);
  }

  // Record the reschedule
  await database.insert(reschedules).values({
    userId: userId,
    fromBookingId: originalBooking.id,
    toBookingId: newBooking.id,
    fromClassId: originalClass.id,
    toClassId: targetClass.id,
    rescheduledAt: now.toISOString(),
  });

  return newBooking;
}
