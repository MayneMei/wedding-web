import Wedding from "@/components/wedding";
import { settings } from "@/lib/wedding-server";
import { emptyCompanion, guestSettings } from "@/lib/wedding-shared";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  return <Wedding demo config={guestSettings(await settings())} invitation={{
    groupName: "Alex & Jamie",
    guests: [{ name: "Alex", status: "pending", dietary: "" }, { name: "Jamie", status: "pending", dietary: "" }],
    plusOne: true,
    companion: emptyCompanion,
    note: "",
    revision: 0,
    updatedAt: null,
  }} />;
}
