import { z } from "zod";
import {
  adminIdentity, adminInvite, allInvitations, createInvitations, groupSchema,
  invitationById, readJson, replySchema, response, saveSettings, settings,
  settingsSchema, writeReply,
} from "@/lib/wedding-server";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), groups: z.array(groupSchema).min(1).max(50) }),
  z.object({ action: z.literal("reply"), id: z.string().uuid(), reply: replySchema }),
  z.object({ action: z.literal("settings"), settings: z.unknown() }),
]);

export async function POST(request: Request) {
  const identity = await adminIdentity();
  if (!identity.role) return response({ error: "unauthorized" }, identity.signedIn ? 403 : 401);
  const parsed = actionSchema.safeParse(await readJson(request));
  if (!parsed.success) return response({ error: "invalid" }, 400);

  const action = parsed.data;
  if (action.action === "create") {
    const created = await createInvitations(action.groups);
    return response({ created, skipped: action.groups.length - created, invitations: await allInvitations() });
  }
  if (action.action === "settings") {
    const config = settingsSchema.safeParse(action.settings);
    if (!config.success) return response({ error: "settings" }, 400);
    const partnerEmail = identity.role === "owner" ? config.data.partnerEmail : (await settings()).partnerEmail;
    const value = { ...config.data, partnerEmail };
    await saveSettings(value);
    return response({ settings: value });
  }

  const invite = await invitationById(action.id);
  if (!invite) return response({ error: "missing" }, 404);
  const result = await writeReply(invite, action.reply, false);
  if (result.error) return response({ error: result.error }, result.error === "conflict" ? 409 : 400);
  return response({ invite: adminInvite(result.updated) });
}
