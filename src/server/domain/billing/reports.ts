import { sql, eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { type db } from "@/db";

export async function getRevenueByMonth(database: typeof db) {
  const rows = await database
    .select({
      month: sql<string>`strftime('%Y-%m', ${payments.createdAt})`,
      totalCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
    })
    .from(payments)
    .where(eq(payments.status, "paid"))
    .groupBy(sql`strftime('%Y-%m', ${payments.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${payments.createdAt}) DESC`);

  return rows.map((r) => ({
    month: r.month,
    totalCents: Number(r.totalCents),
  }));
}

export async function getRevenueByMethod(database: typeof db) {
  const rows = await database
    .select({
      method: payments.method,
      totalCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(payments)
    .where(eq(payments.status, "paid"))
    .groupBy(payments.method)
    .orderBy(sql`sum(${payments.amountCents}) DESC`);

  return rows.map((r) => ({
    method: r.method,
    totalCents: Number(r.totalCents),
    count: Number(r.count),
  }));
}

export async function getRefundCount(database: typeof db) {
  const [result] = await database
    .select({ count: sql<number>`count(*)` })
    .from(payments)
    .where(eq(payments.status, "refunded"));

  return { count: Number(result.count) };
}
