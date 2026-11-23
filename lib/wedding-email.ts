const subject = "Maggie & Mayne’s wedding invitation";

export function invitationEmail(origin: string, token: string, names: string[], eventDate: string, venue: string) {
  const home = new URL(`/invite/${token}`, origin).href;
  const registry = new URL("/registry", origin).href;
  const gif = new URL("/invitation-preview.gif", origin).href;
  const safe = (value: string) => value.replace(/[&<>"']/g, (symbol) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[symbol] ?? symbol);
  const greeting = `Hi ${names.join(" & ")},`;
  const plain = [
    greeting,
    "We’d love to celebrate our wedding with you!",
    [eventDate, venue].join(" · "),
    "Open the invitation to explore the map with our two cats and send your RSVP:",
    home,
    `Gift registry: ${registry}`,
    "With love,\nMaggie & Mayne",
  ].join("\n\n");
  function html(image: string) {
    return `<div style="font-family:Georgia,serif;color:#293e31;max-width:580px;font-size:16px;line-height:1.55">
  <p>${safe(greeting)}</p>
  <p>We’d love to celebrate our wedding with you!</p>
  <p><strong>${safe(eventDate)}</strong><br>${safe(venue)}</p>
  <a href="${safe(home)}"><img src="${safe(image)}" alt="Two illustrated cats exploring our wedding map. Click to open your invitation." width="560" style="display:block;width:100%;max-width:560px;height:auto;border:2px solid #3d5644"></a>
  <p><a href="${safe(home)}" style="color:#36523e;font-weight:bold">Open your invitation &amp; RSVP</a></p>
  <p><a href="${safe(registry)}" style="color:#36523e">Gift registry</a></p>
  <p>With love,<br>Maggie &amp; Mayne</p>
</div>`;
  }
  return { subject, plain, html, gif };
}

function base64(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function mimeText(content: string) {
  return base64(new TextEncoder().encode(content)).match(/.{1,76}/g)?.join("\r\n") ?? "";
}

export async function inviteEmailFile(email: ReturnType<typeof invitationEmail>) {
  const response = await fetch(email.gif);
  if (!response.ok) throw new Error("Couldn’t load the invitation animation.");
  const gif = base64(new Uint8Array(await response.arrayBuffer())).match(/.{1,76}/g)?.join("\r\n");
  const cid = "cats-at-yile-enpei";
  const related = "yile-enpei-related";
  const versions = "yile-enpei-alternatives";
  const lines = [
    "X-Unsent: 1",
    `Subject: =?UTF-8?B?${base64(new TextEncoder().encode(email.subject))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${related}"`, "",
    `--${related}`, `Content-Type: multipart/alternative; boundary="${versions}"`, "",
    `--${versions}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", mimeText(email.plain),
    `--${versions}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", mimeText(email.html(`cid:${cid}`)),
    `--${versions}--`, "",
    `--${related}`, "Content-Type: image/gif; name=invitation-preview.gif", "Content-Transfer-Encoding: base64",
    `Content-ID: <${cid}>`, "Content-Disposition: inline; filename=invitation-preview.gif", "", gif,
    `--${related}--`, "",
  ];
  return new Blob([lines.join("\r\n")], { type: "message/rfc822" });
}
