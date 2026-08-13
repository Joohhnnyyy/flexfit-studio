import { and, eq } from "drizzle-orm";
import { classes, trainerAvailability } from "@/db/schema";
import { type db as DatabaseType } from "@/db";

export async function checkTrainerAvailability(
  database: typeof DatabaseType,
  input: { trainerId: number; startsAt: string; durationMin: number }
) {
  const classStart = new Date(input.startsAt);
  const classEnd = new Date(classStart.getTime() + input.durationMin * 60000);

  const dayOfWeek = classStart.getUTCDay();
  const startTimeStr =
    String(classStart.getUTCHours()).padStart(2, "0") +
    ":" +
    String(classStart.getUTCMinutes()).padStart(2, "0");
  const endTimeStr =
    String(classEnd.getUTCHours()).padStart(2, "0") +
    ":" +
    String(classEnd.getUTCMinutes()).padStart(2, "0");

  const availability = await database
    .select()
    .from(trainerAvailability)
    .where(
      and(
        eq(trainerAvailability.trainerId, input.trainerId),
        eq(trainerAvailability.dayOfWeek, dayOfWeek)
      )
    )
    .get();

  if (!availability) {
    return { available: false, reason: "No availability set for this day" };
  }

  const availStart = availability.startTime;
  const availEnd = availability.endTime;

  const isWithinAvailability =
    startTimeStr >= availStart && endTimeStr <= availEnd;

  if (!isWithinAvailability) {
    return { available: false, reason: "Outside availability hours" };
  }

  const conflictingClasses = await database
    .select()
    .from(classes)
    .where(
      and(
        eq(classes.trainerId, input.trainerId),
        eq(classes.cancelled, false)
      )
    );

  for (const cls of conflictingClasses) {
    const existStart = new Date(cls.startsAt);
    const existEnd = new Date(existStart.getTime() + cls.durationMin * 60000);

    if (classStart < existEnd && classEnd > existStart) {
      return {
        available: false,
        reason: "Trainer already has a class at this time",
      };
    }
  }

  return { available: true };
}
