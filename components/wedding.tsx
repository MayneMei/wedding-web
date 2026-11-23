"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { dateLabel, emptyCompanion, type GuestSettings, type Invite, type Reply } from "@/lib/wedding-shared";
import { useWeddingLanguage } from "./wedding-guest-ui";
import { replyError } from "./reply-form";
import "./journey.css";
import { TrailGame } from "./trail-game";

const stops = [
  { key:"ann-arbor", title:"Ann Arbor", zh:"安娜堡", story:"Where we met and got together.", storyZh:"我们相遇、走到一起的地方。", x:11, y:67.5 },
  { key:"china", title:"Guangzhou & Xiamen", zh:"广州与厦门", story:"Our first trip together, from Guangzhou dim sum and lemon tea to Gulangyu.", storyZh:"第一次一起旅行，从广州的肠粉、点心和柠檬茶，到厦门的鼓浪屿。", x:27, y:43.5 },
  { key:"japan", title:"Japan", zh:"日本", story:"Our first trip abroad together, with yakiniku and sushi.", storyZh:"我们第一次一起出国旅行，一起吃烤肉和寿司。", x:41, y:71 },
  { key:"europe", title:"Europe", zh:"欧洲", story:"From Barcelona to the Swiss Alps and Paris, with croissants along the way.", storyZh:"从巴塞罗那到瑞士雪山，再到巴黎。走累了就停下来吃个可颂。", x:56, y:43 },
  { key:"hollywood", title:"Los Angeles", zh:"洛杉矶", story:"Maggie moved to Los Angeles first to do her master’s at USC, while Mayne was interning in the Bay Area.", storyZh:"Maggie 先到洛杉矶，在 USC 读硕士。那时 Mayne 在湾区实习。", x:73.5, y:69.4 },
  { key:"bay-area", title:"Bay Area", zh:"湾区", story:"Across the Golden Gate, where we call home now.", storyZh:"沿着金门大桥，来到我们现在生活的湾区。", x:88.7, y:44.9 },
] as const;

const route = [
  "M51 751 Q70 734 110 675",
  "M110 675 C183 675 167 482 270 435",
  "M270 435 C307 465 286 672 410 710",
  "M410 710 C481 721 470 450 560 430",
  "M560 430 C657 425 626 665 735 694",
  "M735 694 C824 718 837 465 906 449",
] as const;

function CatArt({ black, face = false }: { black: boolean; face?: boolean }) {
  return <img className="journey-cat-art" alt="" draggable={false}
    src={`/journey-${black ? "toothless" : "coltball"}-${face ? "portrait" : "walk"}.webp`} />;
}
const demoGuests = [{ name: "Alex", status: "pending", dietary: "" }] as const;
const screens = ["welcome","character","roadmap","next-adventure"] as const;

export default function Wedding({ config, invitation, token, demo = false, invalid = false, closed = false }: {
  config: GuestSettings; invitation?: Invite; token?: string; demo?: boolean; invalid?: boolean; closed?: boolean;
}) {
  const { zh, toggle } = useWeddingLanguage();
  const t = (en: string, cn: string) => zh ? cn : en;
  const [page, setPage] = useState(0);
  const [side, setSide] = useState<"bride"|"groom">(invitation?.journey?.side ?? "bride");
  const [step, setStep] = useState(0);
  const [popup, setPopup] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(invitation?.journey?.name ?? "");
  const [contact, setContact] = useState(invitation?.journey?.contact ?? "");
  const [guests, setGuests] = useState<Reply["guests"]>(() => (invitation?.guests ?? demoGuests).map(({status,dietary}) => ({status,dietary})));
  const [companion, setCompanion] = useState(invitation?.companion ?? emptyCompanion);
  const [note, setNote] = useState(invitation?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(invitation?.revision ?? 0);
  const [finished, setFinished] = useState(false);
  const names = invitation?.guests ?? demoGuests;
  const canSubmit = Boolean(demo || token) && !closed && !invalid;
  const attends = guests.some(({status}) => status === "yes");
  const stop = stops[step];
  useEffect(() => {
    const reset = () => { setPage(0); setPopup(false); };
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    window.addEventListener("popstate", reset);
    return () => window.removeEventListener("popstate", reset);
  }, []);

  useEffect(() => {
    document.querySelector<HTMLElement>(".journey-root h1")?.focus({ preventScroll: true });
  }, [page]);

  useEffect(() => {
    if (!popup || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    dialog.current.querySelector<HTMLElement>("h2")?.focus();
  }, [popup, step]);

  function go(next: number) {
    setPage(next);
    window.history.replaceState(null, "", next === 0 ? window.location.pathname : "#" + screens[next]);
    window.scrollTo(0, 0);
  }

  function previous() {
    if (pending) return;
    setError("");
    if (popup) {
      if (popup && step > 0) { setStep(step - 1); return; }
      setPopup(false);
      return;
    }
    if (page === 3) {
      setFinished(false);
      go(2);
      return;
    }
    if (page === 2 && step > 0) { setStep(step - 1); return; }
    go(Math.max(0, page - 1));
  }

  async function continueTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0 && (!name.trim() || !contact.trim())) {
      setError(t("Enter your name and email or phone number.", "请填写姓名、邮箱或手机号。"));
      return;
    }
    setError("");
    if (step < stops.length - 1) { setStep(step + 1); setPopup(false); return; }
    if (!canSubmit) { setFinished(true); setPopup(false); go(3); return; }
    if (pending) return;
    setPending(true); setError("");
    try {
      if (!demo) {
        const payload: Reply = { guests, companion: attends ? companion : emptyCompanion, note, revision, journey: { side, name, contact } };
        const response = await fetch("/api/rsvp/" + token, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
        const data = await response.json() as {error?:string; invite?:Invite};
        if (!response.ok) throw new Error(data.error);
        if (data.invite) setRevision(data.invite.revision);
      }
      setFinished(true); setPopup(false); go(3);
    } catch (e) { setError(replyError(e instanceof Error ? e.message : "", zh)); }
    finally { setPending(false); }
  }

  return <main className="journey-root">
    <div className="journey-top-tools">
      {page > 0 && <button className="journey-back" type="button" onClick={previous}>{t("Back", "返回")}</button>}
      <button className="journey-language" type="button" onClick={toggle} aria-label={t("Switch to Chinese", "切换到英文")}>{zh ? "EN" : "中文"}</button>
    </div>
    {page === 0 && <section className="journey-welcome">
      <header className="welcome-note">
        <p>{t("Welcome to our wedding", "欢迎参加我们的婚礼")}</p>
        <h1 tabIndex={-1}>Maggie &amp; Mayne</h1>
        <p>{t("We’re so glad you’re here. Come take a little walk through our story with our two cats.", "很开心你来了。跟着无牙和煤球走一走，看看我们是怎么一路走到今天的。")}</p>
        <p className="journey-event">{dateLabel(config.date,zh)}<br/>{config.venue}</p>
      </header>
      {invalid && <p className="journey-cover-notice" role="alert">{t("This invitation link is unavailable. Ask Maggie or Mayne for a new link.", "这个邀请链接不可用，请联系 Maggie 或 Mayne。")}</p>}
      <button className="journey-open-arrow" type="button" aria-label={t("Open the invitation", "打开请柬")} onClick={() => go(1)}>
        <svg width="49" height="29" viewBox="0 0 49 29" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18c11 1 23-4 40-5M32 4l12 9-10 11"/></svg>
      </button>
    </section>}
    {page === 1 && <section className="journey-choose">
      <h1 tabIndex={-1}>{t("Choose your character", "选择你的角色")}</h1>
      {!token && !invalid && <small>{t("Sample journey · Use sample details to try it.", "试玩模式 · 可以填示例信息体验。")}</small>}
      <div className="journey-characters">{(["bride","groom"] as const).map((choice) => <button key={choice} onClick={() => {
        if (choice !== side) setStep(0);
        setSide(choice); setFinished(false); setPopup(false); go(2);
      }}><CatArt black={choice === "bride"} face/><strong>{choice === "bride" ? t("Toothless", "无牙") : t("Coalball", "煤球")}</strong>
      <span>{choice === "bride" ? t("Bride’s side", "新娘这边") : t("Groom’s side", "新郎这边")}</span></button>)}</div>
    </section>}
    {page === 2 && <section className="journey-map">
      <header className="journey-map-heading">
        <h1 tabIndex={-1}>{t("Our road to April", "一路走到四月")}</h1>
        <p>{t("Steer with WASD or arrow keys, or tap the map. Collect the keepsake, dodge the yarn and reach the flag.", "用方向键、WASD 或轻点地图控制猫猫。收集纪念物，躲开毛线球，把它送到旗标。")}</p>
      </header>
      <TrailGame key={step} paused={popup} start={step ? stops[step-1] : {x:3,y:80}} goal={stop} step={step} zh={zh} title={t(stop.title,stop.zh)} cat={side==="bride"?"/journey-toothless-walk.webp":"/journey-coltball-walk.webp"} onArrival={()=>setPopup(true)}>
          <figure className="journey-beijing">
            <img src="/waypoint-beijing.webp" alt="" draggable={false} />
            <figcaption>{t("Beijing", "北京")}</figcaption>
          </figure>
          <svg className="journey-trail" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            {route.map((path, i) => <path key={path} d={path} />)}
          </svg>
          {stops.map((place,i) => <div key={place.key} className="journey-stop" data-complete={i < step} aria-current={i === step ? "step" : undefined} style={{left:place.x+"%",top:place.y+"%"}}>
            <img className="journey-sticker" src={`/waypoint-${place.key}.webp`} alt="" draggable={false} />
            <span className="journey-pin">{i < step ? "✓" : i+1}</span><span className="journey-stop-name">{t(place.title,place.zh)}</span>
          </div>)}
      </TrailGame>
      {popup && <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); previous(); }} className="journey-dialog" aria-labelledby="stop-title"><form onSubmit={continueTrip}>
        <p className="journey-kicker">{t("Stop", "第")} {step+1} {t("of", "站，共")} {stops.length} {zh ? "站" : ""}</p>
        <img className="journey-dialog-sticker" src={`/waypoint-${stop.key}.webp`} alt="" />
        <h2 id="stop-title" tabIndex={-1}>{t(stop.title,stop.zh)}</h2><p>{t(stop.story,stop.storyZh)}</p>
        {step === 0 && <>
          <label>{t("Your name", "你的姓名")}<input autoFocus required maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>
          <label>{t("Email or phone", "邮箱或手机号")}<input required maxLength={150} value={contact} onChange={e=>setContact(e.target.value)}/></label>
        </>}
        {step === 1 && <>
          {names.map((guest,i)=><label key={i}>{i === 0 && !invitation && name ? name : guest.name} · {t("Will you attend?", "是否出席？")}<select required value={guests[i].status === "pending" ? "" : guests[i].status} onChange={e=>setGuests(guests.map((g,j)=>j===i?{...g,status:e.target.value as "yes"|"no"}:g))}><option value="">{t("Please choose", "请选择")}</option><option value="yes">{t("Joyfully attending","会出席")}</option><option value="no">{t("Unable to attend","无法出席")}</option></select></label>)}
          {attends && <><label>{t("Will you bring a plus-one?", "会带一位同行宾客（+1）吗？")}<select required value={companion.status==="pending"?"":companion.status} onChange={e=>setCompanion({...companion,status:e.target.value as "yes"|"no"})}><option value="">{t("Please choose","请选择")}</option><option value="yes">{t("Yes","会")}</option><option value="no">{t("No","不会")}</option></select></label>{companion.status==="yes"&&<label>{t("Plus-one name","同行宾客姓名")}<input required maxLength={100} value={companion.name} onChange={e=>setCompanion({...companion,name:e.target.value})}/></label>}</>}
        </>}
        {step === 2 && <>{!attends && <p>{t("No dietary information needed if you’re unable to attend.", "如果无法出席，可以直接继续。")}</p>}{guests.map((guest,i)=>guest.status==="yes"&&<label key={i}>{names[i].name} · {t("Dietary needs (optional)","饮食限制（选填）")}<input maxLength={350} value={guest.dietary} onChange={e=>setGuests(guests.map((g,j)=>j===i?{...g,dietary:e.target.value}:g))}/></label>)}{attends&&companion.status==="yes"&&<label>{companion.name} · {t("Dietary needs (optional)","饮食限制（选填）")}<input maxLength={350} value={companion.dietary} onChange={e=>setCompanion({...companion,dietary:e.target.value})}/></label>}</>}
        {step === 3 && <label>{t("A note for Maggie & Mayne (optional)","想对 Maggie 和 Mayne 说的话（选填）")}<textarea maxLength={800} value={note} onChange={e=>setNote(e.target.value)}/></label>}
        {step === 5 && <dl className="journey-review">
          <div><dt>{t("Name & contact", "姓名与联系方式")}</dt><dd>{name} · {contact}</dd></div>
          <div><dt>{t("Attendance", "出席")}</dt><dd>{names.map((guest,i)=> <span key={i}>{guest.name} — {guests[i].status==="yes"?t("Attending","出席"):t("Unable to attend","无法出席")}</span>)}{attends && companion.status === "yes" && <span>{companion.name}</span>}</dd></div>
        </dl>}
        {error && <p role="alert">{error}</p>}
        <div className="journey-dialog-actions">
          <button type="button" className="journey-back" disabled={pending} onClick={previous}>{t("Back", "返回")}</button>
          <button className="journey-button" disabled={pending}>{pending?t("Saving…","保存中…"):step===stops.length-1&&canSubmit?t("Finish & RSVP","完成并提交 RSVP"):t("Continue","继续")}</button>
        </div>
      </form></dialog>}
    </section>}
    {page === 3 && <section className="journey-end">
      <div className="journey-end-cats"><CatArt black/><CatArt black={false}/></div><h1 tabIndex={-1}>{t("Next adventure…","下一段旅程…")}</h1>
      <p>{t("Thank you for coming along!","谢谢你陪我们走过这段旅程！")}<br/>{attends ? t("See you in April!","四月见！") : t("Sending love from Maggie & Mayne.","Maggie 和 Mayne 送上祝福。")}</p>
      <p role="status">{demo?t("Demo complete. No RSVP was sent.","试玩结束，未发送 RSVP。"):closed?t("RSVP is closed.","RSVP 已截止。"):token?t("Your RSVP has been saved.","你的 RSVP 已保存。"):t("Use your personal invitation link to send your RSVP.","请用专属邀请链接提交 RSVP。")}</p>
      <a className="journey-button" href="/registry">{t("Gift registry","礼物清单")}</a>
      {token && !closed && <button className="journey-link" onClick={() => go(1)}>{t("Edit your RSVP","修改 RSVP")}</button>}
    </section>}
  </main>;
}
