import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const loginAttempts = sqliteTable("login_attempts", {
  clientKey: text("client_key").primaryKey(),
  failureCount: integer("failure_count").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
  lockedUntil: integer("locked_until").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_login_attempts_updated_at").on(table.updatedAt),
]);
