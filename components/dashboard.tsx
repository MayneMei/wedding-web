"use client";

import { useState } from "react";
import type { Status, WeddingSettings } from "@/db/schema";
import { invitationsCsv, parseInvitationsCsv } from "@/lib/wedding-csv";
import { dateLabel, type AdminInvite, type Reply } from "@/lib/wedding-shared";
import { invitationEmail, inviteEmailFile } from "@/lib/wedding-email";
import ReplyForm from "./reply-form";

const states: { [key in Status]: string } = { pending: "Awaiting reply", yes: "Attending", no: "Declined" };

async function adminRequest<T>(body: object): Promise<T> {
  const response = await fetch("/api/admin", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error);
  }
  return await response.json() as T;
}

function readableError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "settings") return "Check the wedding dates, partner email, and registry entries. Registry links should begin with https://.";
  if (code === "invalid" || !code || code === "Failed to fetch") return "Couldn’t save. Check your entries and try again.";
  if (code === "unauthorized") return "Your session has expired. Please sign in again.";
  return code;
}

function downloadFile(name: string, content: string | Blob) {
  const url = URL.createObjectURL(typeof content === "string" ? new Blob([content], { type: "text/csv;charset=utf-8" }) : content);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Dashboard({ initialInvitations, initialSettings, role }: {
  initialInvitations: AdminInvite[];
  initialSettings: WeddingSettings;
  role: "owner" | "partner";
}) {
  const [tab, setTab] = useState<"guests" | "settings">("guests");
  const [invitations, setInvitations] = useState(initialInvitations);
  const [config, setConfig] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [edit, setEdit] = useState<string>();
  const [showLink, setShowLink] = useState<string>();
  const [showEmail, setShowEmail] = useState<string>();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState<File>();
  const [groupName, setGroupName] = useState("");
  const [names, setNames] = useState("");
  const [plusOne, setPlusOne] = useState(false);

  const totals = { yes: 0, no: 0, pending: 0 };
  for (const group of invitations) {
    for (const guest of group.guests) totals[guest.status]++;
    if (group.plusOne && group.companion.status === "yes") totals.yes++;
  }

  const searchKey = search.trim().toLowerCase();
  const visible = invitations.filter((group) => {
    const guests = group.companion.status === "yes" ? [...group.guests, group.companion] : group.guests;
    const matchesSearch = !searchKey || [group.groupName, ...guests.map((guest) => guest.name)]
      .some((name) => name.toLowerCase().includes(searchKey));
    return matchesSearch && (filter === "all" || guests.some((guest) => guest.status === filter));
  });

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setNotice(undefined);
    try { await task(); }
    catch (error) { setNotice({ text: readableError(error), error: true }); }
    finally { setBusy(false); }
  }

  async function addGroups(groups: ReturnType<typeof parseInvitationsCsv>) {
    const result = await adminRequest<{ created: number; skipped: number; invitations: AdminInvite[] }>({ action: "create", groups });
    setInvitations(result.invitations);
    const { created, skipped } = result;
    setNotice({ text: `Added ${created} ${created === 1 ? "group" : "groups"}.${skipped ? ` Skipped ${skipped} existing ${skipped === 1 ? "group" : "groups"}.` : ""}` });
  }

  async function saveReply(id: string, reply: Reply) {
    const result = await adminRequest<{ invite: AdminInvite }>({ action: "reply", id, reply });
    setInvitations((current) => current.map((group) => group.id === id ? result.invite : group));
    setEdit(undefined);
    setNotice({ text: "RSVP updated." });
  }

  function inviteUrl(token: string) {
    return new URL(`/invite/${token}`, window.location.origin).href;
  }

  async function copy(group: AdminInvite) {
    try {
      await navigator.clipboard.writeText(inviteUrl(group.token));
      setNotice({ text: `Invitation link copied for ${group.groupName}.` });
    } catch {
      setShowLink(group.id);
    }
  }

  function draft(group: AdminInvite) {
    return invitationEmail(window.location.origin, group.token, group.guests.map(({ name }) => name),
      dateLabel(savedSettings.date), savedSettings.venue);
  }

  async function copyEmail(group: AdminInvite) {
    const email = draft(group);
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([email.html(email.gif)], { type: "text/html" }),
        "text/plain": new Blob([email.plain], { type: "text/plain" }),
      })]);
      setNotice({ text: `Invitation email copied for ${group.groupName}. Paste it into your email composer.` });
    } catch {
      setShowEmail(group.id);
      setNotice({ text: "Use Download email for the animated version, or copy the text shown below." });
    }
  }

  async function emailFile(group: AdminInvite) {
    const file = await inviteEmailFile(draft(group));
    downloadFile("Maggie-and-Mayne-Invitation.eml", file);
    setNotice({ text: `Downloaded the unsent invitation for ${group.groupName}.` });
  }

  function changeTab(next: "guests" | "settings") {
    setTab(next);
    setNotice(undefined);
  }

  return <main className="admin-shell">
    <header className="admin-head">
      <div>
        <a className="wordmark" href="/" aria-label="Wedding homepage">Y<span>&amp;</span>E</a>
        <h1>Wedding dashboard</h1>
      </div>
      <div className="admin-toolbar">
        <a className="text-button" href="/demo" target="_blank" rel="noreferrer">Sample invite</a>
        <a className="text-button" href="/invitation-preview.gif" target="_blank" rel="noreferrer">Email animation</a>
        <a className="text-button" href="/" target="_blank" rel="noreferrer">View wedding site</a>
      </div>
    </header>
    <nav className="admin-tabs" aria-label="Dashboard">
      <button type="button" aria-pressed={tab === "guests"} onClick={() => changeTab("guests")}>Guest list</button>
      <button type="button" aria-pressed={tab === "settings"} onClick={() => changeTab("settings")}>Wedding &amp; registry</button>
    </nav>
    {notice && <p className={`admin-notice${notice.error ? " error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p>}

    {tab === "guests" && <>
      <div className="admin-stats" aria-label="Guest totals">
        {(["yes", "no", "pending"] as const).map((status) => <div className="admin-stat" key={status}>
          <strong>{totals[status]}</strong>{states[status]}
        </div>)}
      </div>
      <section className="admin-card" aria-label="Guest list">
        <div className="admin-filters">
          <label className="input-label">Search guests
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Guest or group name" />
          </label>
          <label className="input-label">Attendance
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">All replies</option>
              {Object.entries(states).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
            </select>
          </label>
          <button className="button button-outline" type="button" onClick={() => downloadFile("wedding-rsvp.csv", invitationsCsv(invitations))}>Export CSV</button>
        </div>
        {visible.length === 0 && <p>{invitations.length ? "No guests match these filters." : "Add a group or import your guest list below."}</p>}
        <div className="admin-list">{visible.map((group) => <article className="admin-invite" key={group.id}>
          <header>
            <h3>{group.groupName}</h3>
            <div className="admin-toolbar">
              <button type="button" className="text-button" onClick={() => copy(group)}>Copy invite link</button>
              <button type="button" className="text-button" onClick={() => copyEmail(group)}>Copy email</button>
              <button type="button" className="text-button" disabled={busy} onClick={() => run(() => emailFile(group))}>Download email</button>
              <button type="button" className="text-button" onClick={() => setEdit(edit === group.id ? undefined : group.id)}>Edit RSVP</button>
            </div>
          </header>
          <p>{group.guests.map((guest) => `${guest.name} · ${states[guest.status]}`).join("  /  ")}</p>
          {group.plusOne && <p>Plus-one{group.companion.name ? ` · ${group.companion.name}` : ""} · {states[group.companion.status]}</p>}
          {group.journey && <p>{group.journey.side === "bride" ? "Bride’s side" : "Groom’s side"} · {group.journey.name} · {group.journey.contact}</p>}
          {showLink === group.id && <code>{inviteUrl(group.token)}</code>}
          {showEmail === group.id && <label className="input-label">Invitation email text
            <textarea readOnly rows={6} value={draft(group).plain} onFocus={(event) => event.target.select()} />
          </label>}
          {edit === group.id && <ReplyForm invite={group} key={group.revision} admin onSave={(reply) => saveReply(group.id, reply)} onCancel={() => setEdit(undefined)} />}
        </article>)}</div>
      </section>
      <div className="admin-grid" style={{ marginTop: 15 }}>
        <form className="admin-card admin-stack" onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const guests = names.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
            if (!guests.length || guests.length > 12 || guests.some((name) => name.length > 100)) {
              throw new Error("Enter 1–12 names, each on a separate line.");
            }
            await addGroups([{ groupName, names: guests, plusOne }]);
            setGroupName(""); setNames(""); setPlusOne(false);
          });
        }}>
          <h2>Add an invitation</h2>
          <label className="input-label">Group name<input value={groupName} maxLength={100} required onChange={(event) => setGroupName(event.target.value)} /></label>
          <label className="input-label">Guest names, one per line<textarea rows={3} required value={names} onChange={(event) => setNames(event.target.value)} /></label>
          <label className="admin-check"><input type="checkbox" checked={plusOne} onChange={(event) => setPlusOne(event.target.checked)} /> Show a plus-one in the manual RSVP editor before the guest replies</label>
          <div><button className="button" disabled={busy}>Create link</button></div>
        </form>
        <form className="admin-card admin-stack" onSubmit={(event) => {
          event.preventDefault();
          if (!csv) return;
          void run(async () => {
            if (csv.size > 75_000) throw new Error("Choose a CSV under 75 KB.");
            await addGroups(parseInvitationsCsv(await csv.text()));
            setCsv(undefined);
            const field = document.getElementById("rsvp-upload") as HTMLInputElement | null;
            if (field) field.value = "";
          });
        }}>
          <h2>Import guest list</h2>
          <small>Use one row per guest. Enter the same group name for people sharing an invitation.</small>
          <label className="input-label">Guest list CSV
            <input id="rsvp-upload" type="file" accept=".csv,text/csv" required onChange={(event) => setCsv(event.target.files?.[0])} />
          </label>
          <div className="form-actions">
            <button className="button" disabled={busy}>Import CSV</button>
            <button className="text-button" type="button" onClick={() => downloadFile("guest-list-template.csv", "group,guest,plus_one\r\nAlex and Jamie,Alex,no\r\nAlex and Jamie,Jamie,no\r\nMorgan,Morgan,yes\r\n")}>Get CSV template</button>
          </div>
        </form>
      </div>
    </>}

    {tab === "settings" && <form className="admin-card admin-settings" onSubmit={(event) => {
      event.preventDefault();
      void run(async () => {
        const result = await adminRequest<{ settings: WeddingSettings }>({ action: "settings", settings: config });
        setConfig(result.settings);
        setSavedSettings(result.settings);
        setNotice({ text: "Wedding details and registry saved." });
      });
    }}>
      <h2 className="wide">Wedding details</h2>
      <label className="input-label">Wedding date
        <input type="date" required value={config.date} onChange={(event) => setConfig({ ...config, date: event.target.value })} />
      </label>
      <label className="input-label">RSVP deadline (Pacific time)
        <input type="date" max={config.date} value={config.deadline} onChange={(event) => setConfig({ ...config, deadline: event.target.value })} />
      </label>
      <label className="input-label">Venue
        <input required maxLength={100} value={config.venue} onChange={(event) => setConfig({ ...config, venue: event.target.value })} />
      </label>
      <label className="input-label">City and state
        <input required maxLength={100} value={config.location} onChange={(event) => setConfig({ ...config, location: event.target.value })} />
      </label>
      <label className="input-label">Schedule
        <textarea rows={3} maxLength={1200} value={config.schedule} onChange={(event) => setConfig({ ...config, schedule: event.target.value })} />
      </label>
      <label className="input-label">Parking
        <textarea rows={3} maxLength={1200} value={config.parking} onChange={(event) => setConfig({ ...config, parking: event.target.value })} />
      </label>
      <label className="input-label">Dress code
        <textarea rows={2} maxLength={1200} value={config.attire} onChange={(event) => setConfig({ ...config, attire: event.target.value })} />
      </label>
      {role === "owner" && <label className="input-label">Partner’s ChatGPT email
        <input type="email" value={config.partnerEmail} onChange={(event) => setConfig({ ...config, partnerEmail: event.target.value })} />
      </label>}
      <div className="wide">
        <h2>Gift registry</h2>
        <p><a className="text-button" href="/registry" target="_blank" rel="noreferrer">Open shareable registry page</a></p>
        {config.registry.map((item, index) => {
          function change(field: keyof typeof item, value: string) {
            setConfig({ ...config, registry: config.registry.map((entry, i) => i === index ? { ...entry, [field]: value } : entry) });
          }
          return <div className="registry-editor" key={index}>
            <label className="input-label">Registry or item name
              <input required maxLength={100} value={item.name} onChange={(event) => change("name", event.target.value)} />
            </label>
            <label className="input-label">Link (optional)
              <input type="url" maxLength={1500} placeholder="https://" value={item.url} onChange={(event) => change("url", event.target.value)} />
            </label>
            <label className="input-label">Note (optional)
              <input maxLength={250} value={item.note} onChange={(event) => change("note", event.target.value)} />
            </label>
            <div><button className="text-button" type="button" onClick={() => setConfig({ ...config, registry: config.registry.filter((_, i) => i !== index) })}>Remove entry</button></div>
          </div>;
        })}
        <button className="text-button" type="button" disabled={config.registry.length >= 20} onClick={() => setConfig({ ...config, registry: [...config.registry, { name: "", url: "", note: "" }] })}>Add registry entry</button>
      </div>
      <div className="wide"><button className="button" disabled={busy}>Save wedding settings</button></div>
    </form>}
  </main>;
}
