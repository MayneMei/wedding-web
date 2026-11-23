import { leaderboard, response } from "@/lib/wedding-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return response({ board: await leaderboard(10) });
  } catch {
    return response({ board: [] });
  }
}
