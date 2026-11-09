import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const lumProjects = sqliteTable("lum_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
