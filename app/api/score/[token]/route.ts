import { invitationByToken, leaderboard, readJson, response, saveScore, scoreSchema } from "@/lib/wedding-server";
import { tokenPattern } from "@/lib/wedding-shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenPattern.test(token)) return response({ error: "missing" }, 404);
  const parsed = scoreSchema.safeParse(await readJson(request));
  if (!parsed.success) return response({ error: "invalid" }, 400);
  const invite = await invitationByToken(token);
  if (!invite) return response({ error: "missing" }, 404);
  const saved = await saveScore(invite, parsed.data);
  return response({ ...saved, board: await leaderboard(10, invite.id) });
}
