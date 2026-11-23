import { deletePhoto, getPhoto, invitationByToken, photoResponse, photoSlotName, photoSlotSchema, readImage, response, savePhoto, settings } from "@/lib/wedding-server";
import { deadlineClosed, tokenPattern } from "@/lib/wedding-shared";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

// A guest's own headshot for the personalized wedding gift: view, upload (raw image body) or remove.
async function target(request: Request, { params }: Context) {
  const { token } = await params;
  if (!tokenPattern.test(token)) return null;
  const slot = photoSlotSchema.safeParse(new URL(request.url).searchParams.get("slot"));
  if (!slot.success) return null;
  const invite = await invitationByToken(token);
  if (!invite || !photoSlotName(invite, slot.data)) return null;
  return { invite, slot: slot.data };
}

export async function GET(request: Request, context: Context) {
  const found = await target(request, context);
  const photo = found && await getPhoto(found.invite.id, found.slot);
  return photo ? photoResponse(photo) : response({ error: "missing" }, 404);
}

export async function PUT(request: Request, context: Context) {
  const found = await target(request, context);
  if (!found) return response({ error: "missing" }, 404);
  if (deadlineClosed((await settings()).deadline)) return response({ error: "closed" }, 403);
  const image = await readImage(request);
  if (!image) return response({ error: "photo" }, 400);
  await savePhoto(found.invite, found.slot, image);
  return response({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  const found = await target(request, context);
  if (!found) return response({ error: "missing" }, 404);
  if (deadlineClosed((await settings()).deadline)) return response({ error: "closed" }, 403);
  await deletePhoto(found.invite.id, found.slot);
  return response({ ok: true });
}
