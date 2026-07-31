import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commandLogsTable = pgTable("command_logs", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  source: text("source").notNull(), // 'local_router' | 'gemini_api'
  reply: text("reply").notNull(),
  matchedPattern: text("matched_pattern"),
  action: text("action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommandLogSchema = createInsertSchema(commandLogsTable).omit({ id: true, createdAt: true });
export type InsertCommandLog = z.infer<typeof insertCommandLogSchema>;
export type CommandLog = typeof commandLogsTable.$inferSelect;
