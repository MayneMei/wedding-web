import { blob, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  groupName: text("group_name").notNull(),
  groupKey: text("group_key").notNull().unique(),
  token: text("token").notNull().unique(),
  guests: text("guests", { mode: "json" }).$type<StoredGuest[]>().notNull(),
  plusOne: integer("plus_one", { mode: "boolean" }).notNull(),
  companion: text("companion", { mode: "json" }).$type<Companion>().notNull(),
  journey: text("journey", { mode: "json" }).$type<Journey>(),
  note: text("note").notNull().default(""),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at"),
});

export const weddingSettings = sqliteTable("wedding_settings", {
  id: integer("id").primaryKey(),
  settings: text("settings", { mode: "json" }).$type<WeddingSettings>().notNull(),
});

export const gameScores = sqliteTable("game_scores", {
  invitationId: text("invitation_id").primaryKey(),
  name: text("name").notNull(),
  score: integer("score").notNull(),
  stars: integer("stars").notNull(),
  cat: text("cat").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// One headshot per guest (slot "0".."11") or plus-one (slot "companion"), for the personalized wedding gifts.
export const guestPhotos = sqliteTable("guest_photos", {
  invitationId: text("invitation_id").notNull(),
  slot: text("slot").notNull(),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.invitationId, table.slot] })]);

export type Status = "pending" | "yes" | "no";
export type GuestAnswer = { status: Status; dietary: string };
export type StoredGuest = GuestAnswer & { name: string };
export type Companion = GuestAnswer & { name: string };
export type RegistryItem = { name: string; url: string; note: string };
export type WeddingSettings = {
  date: string;
  venue: string;
  location: string;
  deadline: string;
  schedule: string;
  parking: string;
  attire: string;
  partnerEmail: string;
  registry: RegistryItem[];
};

export type Journey = { side: "bride" | "groom"; name: string; contact: string };
