import { invitationByToken, publicInvite, readJson, replySchema, response, settings, writeReply } from "@/lib/wedding-server";
import { deadlineClosed, tokenPattern } from "@/lib/wedding-shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenPattern.test(token)) return response({ error: "missing" }, 404);
  const parsed = replySchema.safeParse(await readJson(request));
  if (!parsed.success) return response({ error: "invalid" }, 400);
  const [invite, config] = await Promise.all([invitationByToken(token), settings()]);
  if (!invite) return response({ error: "missing" }, 404);
  if (deadlineClosed(config.deadline)) return response({ error: "closed" }, 403);
  const result = await writeReply(invite, parsed.data, true);
  if (result.error) return response({ error: result.error }, result.error === "conflict" ? 409 : 400);
  return response({ invite: publicInvite(result.updated) });
}
