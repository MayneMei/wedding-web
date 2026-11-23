import Wedding from "@/components/wedding";
import { settings } from "@/lib/wedding-server";
import { guestSettings } from "@/lib/wedding-shared";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <Wedding config={guestSettings(await settings())} />;
}
