import { adminIdentity, getPhoto, invitationById, photoResponse, photoSlotName, photoSlotSchema, response } from "@/lib/wedding-server";

export const dynamic = "force-dynamic";

// Owner/partner access to guest headshots: ?id=<invitation id>&slot=<slot>[&download=1]
export async function GET(request: Request) {
  const identity = await adminIdentity();
  if (!identity.role) return response({ error: "unauthorized" }, identity.signedIn ? 403 : 401);
  const params = new URL(request.url).searchParams;
  const slot = photoSlotSchema.safeParse(params.get("slot"));
  const id = params.get("id") ?? "";
  if (!slot.success || !/^[0-9a-f-]{36}$/.test(id)) return response({ error: "missing" }, 404);
  const photo = await getPhoto(id, slot.data);
  if (!photo) return response({ error: "missing" }, 404);
  const invite = await invitationById(id);
  const current = (invite && photoSlotName(invite, slot.data)) || photo.name;
  const safeName = current.replace(/[^\p{L}\p{N} _+-]/gu, "").trim() || "guest";
  return photoResponse(photo, params.get("download") ? safeName : undefined);
}
