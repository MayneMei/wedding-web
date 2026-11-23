import Wedding from "@/components/wedding";
import { invitationByToken, photoSlots, publicInvite, settings } from "@/lib/wedding-server";
import { deadlineClosed, guestSettings, tokenPattern } from "@/lib/wedding-shared";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [config, invite] = await Promise.all([
    settings(),
    tokenPattern.test(token) ? invitationByToken(token) : undefined,
  ]);
  const photos = invite ? await photoSlots(invite.id) : [];
  return <Wedding
    config={guestSettings(config)}
    invitation={invite ? { ...publicInvite(invite), photos } : undefined}
    token={invite ? token : undefined}
    invalid={!invite}
    closed={deadlineClosed(config.deadline)}
  />;
}
