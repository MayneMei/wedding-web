import type { Companion, GuestAnswer, StoredGuest, WeddingSettings } from "@/db/schema";

export type Reply = {
  guests: GuestAnswer[];
  companion: Companion;
  note: string;
  journey?: import("@/db/schema").Journey | null;
  revision: number;
};

export type Invite = Omit<Reply, "guests"> & {
  groupName: string;
  guests: StoredGuest[];
  plusOne: boolean;
  updatedAt: string | null;
  /** Photo slots ("0".."11" or "companion") that already have a headshot. */
  photos?: string[];
};

export type AdminInvite = Invite & { id: string; token: string };
export type GuestSettings = Omit<WeddingSettings, "partnerEmail">;

export const defaultSettings: WeddingSettings = {
  date: "2027-04-23",
  venue: "Brindare Napa Valley",
  location: "St. Helena, California",
  deadline: "",
  schedule: "",
  parking: "",
  attire: "",
  partnerEmail: "",
  registry: [],
};

export const emptyCompanion: Companion = { name: "", status: "pending", dietary: "" };
export const tokenPattern = /^[a-f0-9]{48}$/;

export function guestSettings(settings: WeddingSettings): GuestSettings {
  const { date, venue, location, deadline, schedule, parking, attire, registry } = settings;
  return { date, venue, location, deadline, schedule, parking, attire, registry };
}

export function deadlineClosed(deadline: string, now = new Date()) {
  if (!deadline) return false;
  const localDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => localDate.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}` > deadline;
}

export function dateLabel(date: string, zh = false, short = false) {
  if (!date) return "";
  return new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: short ? "short" : "long",
    day: "numeric",
    ...(short ? {} : { weekday: "long" }),
  }).format(new Date(`${date}T12:00:00Z`));
}
