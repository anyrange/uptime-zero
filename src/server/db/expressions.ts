import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

export function dayFromIso(value: SQLWrapper) {
  return sql<string>`substr(${value}, 1, 10)`;
}

export function sumWhere(value: SQLWrapper, condition: SQL) {
  return sql<number>`sum(case when ${condition} then ${value} else 0 end)`.mapWith(
    Number,
  );
}

export function countWhere(condition: SQL) {
  return sql<number>`sum(case when ${condition} then 1 else 0 end)`.mapWith(
    Number,
  );
}

export function sumValues(value: SQLWrapper) {
  return sql<number>`coalesce(sum(${value}), 0)`.mapWith(Number);
}
