"use client";

import { useState } from "react";
import type { GuestAnswer, Status } from "@/db/schema";
import { emptyCompanion, type Invite, type Reply } from "@/lib/wedding-shared";

export function replyError(error: string, zh = false) {
  const messages: { [key: string]: [string, string] } = {
    attendance: ["Please choose a response for each guest.", "请为每位宾客选择是否出席。"],
    companion: ["Please choose whether you’re bringing a guest.", "请选择是否携带同行人。"],
    companion_name: ["Please enter your guest’s name.", "请填写同行人的姓名。"],
    conflict: ["This reply has changed. Refresh the page before editing again.", "这份回复已更新，请刷新页面后再修改。"],
    closed: ["The RSVP deadline has passed. Please contact Yile or Enpei.", "回复已截止，请联系 Yile 或 Enpei。"],
    unauthorized: ["Please sign in again.", "请重新登录。"],
  };
  return (messages[error] ?? ["Couldn’t save your reply. Please try again.", "暂时无法保存，请重试。"])[zh ? 1 : 0];
}

export default function ReplyForm({ invite, zh = false, admin = false, onSave, onCancel }: {
  invite: Invite;
  zh?: boolean;
  admin?: boolean;
  onSave: (reply: Reply) => Promise<void>;
  onCancel?: () => void;
}) {
  const text = (en: string, cn: string) => zh ? cn : en;
  const [guests, setGuests] = useState<GuestAnswer[]>(invite.guests.map(({ status, dietary }) => ({ status, dietary })));
  const [companion, setCompanion] = useState(invite.companion);
  const [note, setNote] = useState(invite.note);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const companionVisible = invite.plusOne && guests.some((guest) => guest.status === "yes");

  function changeGuest(index: number, value: Partial<GuestAnswer>) {
    setGuests((current) => current.map((guest, i) => i === index ? { ...guest, ...value } : guest));
  }

  function choices(name: string, value: Status, onChange: (next: Status) => void, companionField = false) {
    const available: Status[] = admin ? ["yes", "no", "pending"] : ["yes", "no"];
    const labels = companionField
      ? { yes: text("Bringing a guest", "携带同行人"), no: text("Just me", "不携带"), pending: text("Pending", "尚未回复") }
      : { yes: text("Joyfully accepts", "确认出席"), no: text("Regretfully declines", "无法出席"), pending: text("Pending", "尚未回复") };
    return <div className="choices">{available.map((status) => (
      <label className="choice" key={status}>
        <input type="radio" name={name} value={status} checked={value === status} onChange={() => onChange(status)} required={!admin} />
        <span>{labels[status]}</span>
      </label>
    ))}</div>;
  }

  return <form className="reply-form" onSubmit={async (event) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await onSave({
        guests,
        companion: companionVisible ? companion : emptyCompanion,
        note,
        revision: invite.revision,
      });
    } catch (failure) {
      setError(replyError(failure instanceof Error ? failure.message : "", zh));
    } finally {
      setPending(false);
    }
  }}>
    {invite.guests.map((guest, index) => <fieldset key={index}>
      <legend>{guest.name}</legend>
      {choices(`guest-${index}`, guests[index].status, (status) => changeGuest(index, { status }))}
      {guests[index].status === "yes" && <label className="input-label">
        {text("Dietary needs or allergies (optional)", "饮食限制或过敏（选填）")}
        <input maxLength={350} value={guests[index].dietary} onChange={(event) => changeGuest(index, { dietary: event.target.value })} />
      </label>}
    </fieldset>)}
    {companionVisible && <fieldset>
      <legend>{text("Your plus-one", "同行人")}</legend>
      {choices("companion", companion.status, (status) => setCompanion({ ...companion, status }), true)}
      {companion.status === "yes" && <>
        <label className="input-label">{text("Guest’s full name", "同行人姓名")}
          <input maxLength={100} required value={companion.name} onChange={(event) => setCompanion({ ...companion, name: event.target.value })} />
        </label>
        <label className="input-label">{text("Dietary needs or allergies (optional)", "饮食限制或过敏（选填）")}
          <input maxLength={350} value={companion.dietary} onChange={(event) => setCompanion({ ...companion, dietary: event.target.value })} />
        </label>
      </>}
    </fieldset>}
    <label className="input-label">{text("A note for us (optional)", "想对我们说的话（选填）")}
      <textarea rows={3} maxLength={800} value={note} onChange={(event) => setNote(event.target.value)} />
    </label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">
      <button className="button" disabled={pending} type="submit">
        {pending ? text("Saving…", "保存中…") : admin ? text("Save changes", "保存修改") : text("Send my RSVP", "提交回复")}
      </button>
      {onCancel && <button type="button" className="text-button" onClick={onCancel}>{text("Cancel", "取消")}</button>}
    </div>
  </form>;
}
