import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const preferencesTable = pgTable("preferences", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // e.g. 'music', 'tasks', 'utilities'
  platform: text("platform").notNull(), // e.g. 'spotify', 'youtube', 'local'
  count: integer("count").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPreferenceSchema = createInsertSchema(preferencesTable).omit({ id: true, updatedAt: true });
export type InsertPreference = z.infer<typeof insertPreferenceSchema>;
export type Preference = typeof preferencesTable.$inferSelect;
