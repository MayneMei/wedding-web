import { env } from "cloudflare:workers";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { gameScores, invitations, weddingSettings } from "@/db/schema";
import { defaultSettings, emptyCompanion } from "./wedding-shared";

export const answerSchema = z.object({
  status: z.enum(["pending", "yes", "no"]),
  dietary: z.string().trim().max(350),
});

export const replySchema = z.object({
  guests: z.array(answerSchema).min(1).max(12),
  companion: answerSchema.extend({ name: z.string().trim().max(100) }),
  note: z.string().trim().max(800),
  journey: z.object({ side: z.enum(["bride", "groom"]), name: z.string().trim().min(1).max(100), contact: z.string().trim().min(1).max(150) }).optional().nullable(),
  revision: z.number().int().nonnegative(),
});

const name = z.string().trim().min(1).max(100);
export const groupSchema = z.object({
  groupName: name,
  names: z.array(name).min(1).max(12),
  plusOne: z.boolean(),
});

const calendarDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
export const settingsSchema = z.object({
  date: calendarDate,
  venue: name,
  location: name,
  deadline: z.union([calendarDate, z.literal("")]),
  schedule: z.string().trim().max(1200),
  parking: z.string().trim().max(1200),
  attire: z.string().trim().max(1200),
  partnerEmail: z.union([z.string().trim().email(), z.literal("")]),
  registry: z.array(z.object({
    name,
    url: z.union([z.literal(""), z.string().trim().max(1500).url().refine((value) => /^https:\/\//i.test(value))]),
    note: z.string().trim().max(250),
  })).max(20),
}).refine((value) => !value.deadline || value.deadline <= value.date);

export async function settings() {
  const [row] = await getDb().select().from(weddingSettings).where(eq(weddingSettings.id, 1));
  return { ...defaultSettings, ...row?.settings };
}

export async function saveSettings(value: z.infer<typeof settingsSchema>) {
  await getDb().insert(weddingSettings).values({ id: 1, settings: value })
    .onConflictDoUpdate({ target: weddingSettings.id, set: { settings: value } });
}

export async function adminIdentity() {
  const user = await getChatGPTUser();
  if (!user?.email) return { signedIn: false, role: null };
  const email = user.email.trim().toLowerCase();
  const owner = env.WEDDING_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner) return { signedIn: true, role: null };
  if (email === owner) return { signedIn: true, role: "owner" as const };
  const config = await settings();
  const partner = config.partnerEmail.trim().toLowerCase();
  return { signedIn: true, role: partner === email ? "partner" as const : null };
}

export function response(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return null;
  if (request.headers.get("sec-fetch-site") === "cross-site") return null;

  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 96_000) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch {
    return null;
  }
}

export type Record = typeof invitations.$inferSelect;

export function publicInvite({ groupName, guests, plusOne, companion, note, journey, revision, updatedAt }: Record) {
  return { groupName, guests, plusOne, companion, note, journey, revision, updatedAt };
}

export function adminInvite(row: Record) {
  return { ...publicInvite(row), id: row.id, token: row.token };
}

export async function invitationByToken(token: string) {
  const [record] = await getDb().select().from(invitations).where(eq(invitations.token, token));
  return record;
}

export async function invitationById(id: string) {
  const [record] = await getDb().select().from(invitations).where(eq(invitations.id, id));
  return record;
}

export async function allInvitations() {
  const rows = await getDb().select().from(invitations).orderBy(asc(invitations.groupName));
  return rows.map(adminInvite);
}

export async function createInvitations(groups: z.infer<typeof groupSchema>[]) {
  const records = groups.map(({ groupName, names, plusOne }) => ({
    id: crypto.randomUUID(),
    groupName,
    groupKey: groupName.normalize("NFKC").toLowerCase(),
    token: Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    guests: names.map((guest) => ({ name: guest, status: "pending" as const, dietary: "" })),
    plusOne,
    companion: emptyCompanion,
  }));
  const db = getDb();
  const queries = records.map((row) => db.insert(invitations).values(row)
    .onConflictDoNothing({ target: invitations.groupKey }).returning({ id: invitations.id }));
  const [first, ...rest] = queries;
  if (!first) return 0;
  const results = await db.batch([first, ...rest]);
  return results.filter((rows) => rows.length !== 0).length;
}

export async function writeReply(row: Record, data: z.infer<typeof replySchema>, guestMode: boolean) {
  if (data.revision !== row.revision) return { error: "conflict" as const };
  if (data.guests.length !== row.guests.length) return { error: "invalid" as const };
  if (guestMode && data.guests.some((guest) => guest.status === "pending")) {
    return { error: "attendance" as const };
  }
  const guestJourney = guestMode && Boolean(data.journey);
  const invitesCompanion = (row.plusOne || guestJourney) && data.guests.some((guest) => guest.status === "yes");
  if (invitesCompanion && guestMode && data.companion.status === "pending") {
    return { error: "companion" as const };
  }
  if (invitesCompanion && data.companion.status === "yes" && !data.companion.name) {
    return { error: "companion_name" as const };
  }

  const guests = row.guests.map((guest, index) => ({
    name: guest.name,
    status: data.guests[index].status,
    dietary: data.guests[index].status === "yes" ? data.guests[index].dietary : "",
  }));
  const companion = invitesCompanion ? {
    status: data.companion.status,
    name: data.companion.status === "yes" ? data.companion.name : "",
    dietary: data.companion.status === "yes" ? data.companion.dietary : "",
  } : emptyCompanion;
  const [updated] = await getDb().update(invitations)
    .set({ guests, companion, plusOne: row.plusOne || (guestJourney && invitesCompanion), note: data.note, journey: data.journey ?? row.journey, revision: row.revision + 1, updatedAt: new Date().toISOString() })
    .where(and(eq(invitations.id, row.id), eq(invitations.revision, row.revision)))
    .returning();
  if (!updated) return { error: "conflict" as const };
  return { updated };
}

// ---------- Road-trip game leaderboard ----------
export const scoreSchema = z.object({
  score: z.number().int().min(0).max(60000),
  stars: z.number().int().min(0).max(18),
  cat: z.enum(["bride", "groom"]),
});

export type LeaderboardEntry = { name: string; score: number; stars: number; cat: "bride" | "groom"; you?: boolean };

// Show only a first name (or a short prefix) on the public board.
function boardName(row: Record) {
  const full = (row.journey?.name || row.guests[0]?.name || row.groupName).trim();
  const first = full.split(/\s+/)[0] ?? full;
  return Array.from(first).slice(0, 14).join("");
}

export async function saveScore(row: Record, data: z.infer<typeof scoreSchema>) {
  const now = new Date().toISOString();
  const db = getDb();
  await db.insert(gameScores)
    .values({ invitationId: row.id, name: boardName(row), score: data.score, stars: data.stars, cat: data.cat, updatedAt: now })
    .onConflictDoUpdate({
      target: gameScores.invitationId,
      set: {
        name: boardName(row),
        score: sql`max(${gameScores.score}, excluded.score)`,
        stars: sql`max(${gameScores.stars}, excluded.stars)`,
        cat: sql`case when excluded.score >= ${gameScores.score} then excluded.cat else ${gameScores.cat} end`,
        updatedAt: now,
      },
    });
  const [mine] = await db.select().from(gameScores).where(eq(gameScores.invitationId, row.id));
  const [{ ahead }] = await db.select({ ahead: sql<number>`count(*)` }).from(gameScores).where(gt(gameScores.score, mine.score));
  return { best: mine.score, rank: Number(ahead) + 1 };
}

export async function leaderboard(limit = 10, invitationId?: string): Promise<LeaderboardEntry[]> {
  const rows = await getDb().select().from(gameScores).orderBy(desc(gameScores.score), asc(gameScores.updatedAt)).limit(limit);
  return rows.map((row) => ({
    name: row.name, score: row.score, stars: row.stars, cat: row.cat === "groom" ? "groom" : "bride",
    ...(invitationId && row.invitationId === invitationId ? { you: true } : {}),
  }));
}
