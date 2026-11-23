import type { AdminInvite } from "./wedding-shared";

type GroupInput = { groupName: string; names: string[]; plusOne: boolean };

function parseRows(source: string) {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let endedQuote = false;

  function pushField() {
    row.push(value.trim());
    value = "";
    endedQuote = false;
  }

  function pushRow() {
    pushField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (quoted) {
      if (character !== '"') value += character;
      else if (text[i + 1] === '"') { value += '"'; i += 1; }
      else { quoted = false; endedQuote = true; }
      continue;
    }
    if (character === ",") { pushField(); continue; }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && text[i + 1] === "\n") i += 1;
      pushRow();
      continue;
    }
    if (endedQuote) {
      if (character !== " " && character !== "\t") throw new Error("Check the quoted fields in your CSV.");
      continue;
    }
    if (character === '"') {
      if (value.trim()) throw new Error("Check the quoted fields in your CSV.");
      value = "";
      quoted = true;
    } else value += character;
  }
  if (quoted) throw new Error("A quoted field is missing its closing quote.");
  pushRow();
  return rows;
}

export function parseInvitationsCsv(source: string): GroupInput[] {
  const [header, ...rows] = parseRows(source);
  const keys = header?.map((cell) => cell.toLowerCase()) ?? [];
  const groupField = keys.indexOf("group");
  const guestField = keys.indexOf("guest");
  const companionField = keys.indexOf("plus_one");
  if (groupField < 0 || guestField < 0 || companionField < 0 || !rows.length) {
    throw new Error("Use the columns group, guest, plus_one, with one guest per row.");
  }
  const groups = new Map<string, GroupInput>();
  for (const [index, row] of rows.entries()) {
    const groupName = row[groupField];
    const name = row[guestField];
    const flag = (row[companionField] ?? "").toLowerCase();
    if (!groupName || !name || groupName.length > 100 || name.length > 100 || !["", "yes", "no"].includes(flag)) {
      throw new Error(`Check row ${index + 2}. Enter a group and guest name, plus yes or no for plus_one.`);
    }
    const key = groupName.normalize("NFKC").toLowerCase();
    const group = groups.get(key) ?? { groupName, names: [], plusOne: false };
    group.names.push(name);
    group.plusOne ||= flag === "yes";
    if (group.names.length > 12) throw new Error("A group can have up to 12 invited guests.");
    groups.set(key, group);
  }
  if (groups.size > 50) throw new Error("Import up to 50 groups at a time.");
  return [...groups.values()];
}

export function invitationsCsv(invitations: AdminInvite[]) {
  const statusLabel = { pending: "Pending", yes: "Attending", no: "Declined" };
  const rows = [["Invite group", "Guest", "Status", "Dietary needs", "Note", "Wedding side", "Respondent", "Contact"]];
  for (const group of invitations) {
    for (const guest of group.guests) {
      rows.push([group.groupName, guest.name, statusLabel[guest.status], guest.dietary, group.note, group.journey?.side ?? "", group.journey?.name ?? "", group.journey?.contact ?? ""]);
    }
    if (group.plusOne && group.companion.status === "yes") {
      rows.push([group.groupName, group.companion.name, "Attending", group.companion.dietary, group.note, group.journey?.side ?? "", group.journey?.name ?? "", group.journey?.contact ?? ""]);
    }
  }
  const cell = (value: string) => {
    const safe = /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" + value : value;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
