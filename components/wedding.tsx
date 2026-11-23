"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { dateLabel, emptyCompanion, type GuestSettings, type Invite, type Reply } from "@/lib/wedding-shared";
import { useWeddingLanguage } from "./wedding-guest-ui";
import { replyError } from "./reply-form";
import "./journey.css";
import "./game.css";
import { StageGame } from "./stage-game";
import { isMuted, setMuted, sfx, startMusic, unlockAudio } from "./game-audio";
import {
  MAX_STARS, achievements, cats, rank, readBest, saveBest, totals,
  type StageResult,
} from "./game-levels";

type BoardEntry = { name: string; score: number; stars: number; cat: "bride" | "groom"; you?: boolean };
const fmt = (n: number) => n.toLocaleString("en-US");

const stops = [
  { key:"ann-arbor", title:"Ann Arbor", zh:"安娜堡", story:"Where we met and got together.", storyZh:"我们相遇、走到一起的地方。", x:11, y:67.5 },
  { key:"china", title:"Guangzhou & Xiamen", zh:"广州与厦门", story:"Our first trip together, from Guangzhou dim sum and lemon tea to Gulangyu.", storyZh:"第一次一起旅行，从广州的肠粉、点心和柠檬茶，到厦门的鼓浪屿。", x:27, y:43.5 },
  { key:"japan", title:"Japan", zh:"日本", story:"Our first trip abroad together, with yakiniku and sushi.", storyZh:"我们第一次一起出国旅行，一起吃烤肉和寿司。", x:41, y:71 },
  { key:"europe", title:"Europe", zh:"欧洲", story:"From Barcelona to the Swiss Alps and Paris, with croissants along the way.", storyZh:"从巴塞罗那到瑞士雪山，再到巴黎。走累了就停下来吃个可颂。", x:56, y:43 },
  { key:"hollywood", title:"Los Angeles", zh:"洛杉矶", story:"Maggie moved to Los Angeles first to do her master’s at USC, while Mayne was interning in the Bay Area.", storyZh:"Maggie 先到洛杉矶，在 USC 读硕士。那时 Mayne 在湾区实习。", x:73.5, y:69.4 },
  { key:"bay-area", title:"Bay Area", zh:"湾区", story:"Across the Golden Gate, where we call home now.", storyZh:"沿着金门大桥，来到我们现在生活的湾区。", x:88.7, y:44.9 },
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
  const [results, setResults] = useState<(StageResult | undefined)[]>(() => Array(stops.length).fill(undefined));
  const [arcade, setArcade] = useState(false);
  const [muted, setMute] = useState(false);
  const [best, setBest] = useState({ score: 0, stars: 0 });
  const [newBest, setNewBest] = useState(false);
  const [board, setBoard] = useState<BoardEntry[] | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const submitted = useRef("");
  const [replay, setReplay] = useState(0);
  const names = invitation?.guests ?? demoGuests;
  const canSubmit = Boolean(demo || token) && !closed && !invalid;
  const attends = guests.some(({status}) => status === "yes");
  const stop = stops[step];
  const run = totals(results);
  useEffect(() => {
    // Saved preferences live in localStorage, which only exists after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMute(isMuted()); setBest(readBest());
  }, []);

  // Post the finished run to the leaderboard (or just load the board for demo / link-less visitors).
  useEffect(() => {
    if (page !== 3) return;
    const runKey = results.map((r) => r?.score ?? "-").join(",") + side;
    if (submitted.current === runKey) return;
    submitted.current = runKey;
    const canPost = Boolean(token) && !demo && run.complete;
    const request = canPost
      ? fetch("/api/score/" + token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ score: run.score, stars: run.stars, cat: side }) })
      : fetch("/api/leaderboard");
    request.then((r) => r.ok ? r.json() as Promise<{ board?: BoardEntry[]; rank?: number }> : Promise.reject(new Error("leaderboard")))
      .then((data: { board?: BoardEntry[]; rank?: number }) => { setBoard(data.board ?? []); setMyRank(data.rank ?? null); })
      .catch(() => setBoard([]));
  }, [page, results, side, token, demo, run.complete, run.score, run.stars]);

  function startGame() {
    unlockAudio();
    sfx.start();
    if (!isMuted()) startMusic();
    go(1);
  }

  function toggleSound() {
    unlockAudio();
    const next = !muted;
    setMuted(next);
    setMute(next);
    if (!next) startMusic();
  }

  function finishRun() {
    const all = totals(results);
    const previous = readBest();
    setNewBest(all.complete && all.score > previous.score);
    if (all.complete) setBest(saveBest(all.score, all.stars));
    setFinished(true); setPopup(false); go(3);
  }

  function playAgain() {
    sfx.start();
    setArcade(true);
    setResults(Array(stops.length).fill(undefined));
    setStep(0); setPopup(false); setFinished(false); setNewBest(false);
    go(2);
  }

  function stageCleared(result: StageResult) {
    setResults((current) => current.map((r, i) => i === step ? result : r));
    setPopup(true);
  }
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
      setReplay((n) => n + 1);
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
    sfx.select();
    if (arcade) {
      if (step < stops.length - 1) { setStep(step + 1); setPopup(false); } else finishRun();
      return;
    }
    if (step === 0 && (!name.trim() || !contact.trim())) {
      setError(t("Enter your name and email or phone number.", "请填写姓名、邮箱或手机号。"));
      return;
    }
    setError("");
    if (step < stops.length - 1) { setStep(step + 1); setPopup(false); return; }
    if (!canSubmit) { finishRun(); return; }
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
      finishRun();
    } catch (e) { setError(replyError(e instanceof Error ? e.message : "", zh)); }
    finally { setPending(false); }
  }

  return <main className="journey-root">
    <div className="journey-top-tools">
      {page > 0 && <button className="journey-back" type="button" onClick={previous}>{t("Back", "返回")}</button>}
      <button className="journey-language" type="button" onClick={toggle} aria-label={t("Switch to Chinese", "切换到英文")}>{zh ? "EN" : "中文"}</button>
      <button className="journey-language game-sound" type="button" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? t("Turn sound on", "打开声音") : t("Turn sound off", "关闭声音")}>{muted ? "🔇" : "🔊"}</button>
    </div>
    {page === 0 && <section className="journey-welcome">
      <img className="welcome-art" src="/wedding-cover-art.webp" width={1122} height={770} fetchPriority="high"
        alt={t("Illustration of Maggie and Mayne holding bento boxes under fireworks, with their two cats", "Maggie 和 Mayne 在烟花下捧着便当的插画，旁边是两只猫")} />
      <header className="welcome-note">
        <p className="welcome-kicker">{t("Welcome to our wedding", "欢迎参加我们的婚礼")}</p>
        <h1 tabIndex={-1}>Maggie <span>&amp;</span> Mayne</h1>
        <p className="welcome-when">{dateLabel(config.date,zh)}<i aria-hidden="true"> · </i><br className="welcome-break" />{config.venue}</p>
      </header>
      {invalid && <p className="journey-cover-notice" role="alert">{t("This invitation link is unavailable. Ask Maggie or Mayne for a new link.", "这个邀请链接不可用，请联系 Maggie 或 Mayne。")}</p>}
      <div className="game-title-actions">
        <button className="game-start" type="button" aria-label={t("Start the game and open the invitation", "开始游戏，打开请柬")} onClick={startGame}>
          {t("Start the journey", "开始旅程")} <span aria-hidden="true">→</span>
        </button>
        <p className="game-title-tag">{t("Walk through our story with our two cats · a 6-stage road trip", "跟着无牙和煤球，走一遍我们的故事 · 6 关公路冒险")}</p>
        {best.score > 0 && <p className="game-best">{t("Your best", "你的最高分")} <b>{fmt(best.score)}</b> · {best.stars}/{MAX_STARS} ★</p>}
      </div>
    </section>}
    {page === 1 && <section className="journey-choose">
      <h1 tabIndex={-1}>{t("Choose your character", "选择你的角色")}</h1>
      {!token && !invalid && <small>{t("Sample journey · Use sample details to try it.", "试玩模式 · 可以填示例信息体验。")}</small>}
      <div className="journey-characters">{(["bride","groom"] as const).map((choice) => <button key={choice} onClick={() => {
        sfx.select();
        if (choice !== side) { setStep(0); setResults(Array(stops.length).fill(undefined)); }
        setSide(choice); setFinished(false); setPopup(false); go(2);
      }}><CatArt black={choice === "bride"} face/><strong>{choice === "bride" ? t("Toothless", "无牙") : t("Coalball", "煤球")}</strong>
      <span>{choice === "bride" ? t("Bride’s side", "新娘这边") : t("Groom’s side", "新郎这边")}</span>
      <dl className="game-statbars">{([["speed", t("Speed", "速度")], ["magnet", t("Reach", "拾取范围")], ["dash", t("Dash", "冲刺")]] as const).map(([k, label]) =>
        <div key={k}><dt>{label}</dt><dd><i style={{ width: cats[choice].stats[k] * 20 + "%" }} /></dd></div>)}</dl>
      <em className="game-perk">{choice === "bride" ? t("Perk · Zoomies: the fastest paws in the family", "特长 · 跑酷：全家跑得最快") : t("Perk · Big appetite: grabs hearts from farther away", "特长 · 大胃王：远远就能吃到爱心")}</em>
      </button>)}</div>
    </section>}
    {page === 2 && <section className="journey-map">
      <header className="journey-map-heading">
        <h1 tabIndex={-1}>{t("Our road to April", "一路走到四月")}</h1>
        {arcade && <p className="game-mode">{t("Score attack", "冲分模式")}</p>}
      </header>
      <StageGame key={step + "-" + replay} paused={popup} start={step ? stops[step-1] : {x:3,y:80}} stage={step} zh={zh}
        stops={stops.map((place) => ({ key: place.key, title: t(place.title, place.zh), x: place.x, y: place.y }))}
        stars={results.map((r) => r?.stars)}
        cat={side} catImg={side==="bride"?"/journey-toothless-walk.webp":"/journey-coltball-walk.webp"} onClear={stageCleared} />
      {popup && <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); previous(); }} className="journey-dialog" aria-labelledby="stop-title"><form onSubmit={continueTrip}>
        <p className="journey-kicker">{t("Stop", "第")} {step+1} {t("of", "站，共")} {stops.length} {zh ? "站" : ""}{results[step] && <span className="game-kicker-score"> · <b>{"★".repeat(results[step]!.stars)}{"☆".repeat(3 - results[step]!.stars)}</b> · {fmt(results[step]!.score)} {t("pts", "分")}</span>}</p>
        <img className="journey-dialog-sticker" src={`/waypoint-${stop.key}.webp`} alt="" />
        <h2 id="stop-title" tabIndex={-1}>{t(stop.title,stop.zh)}</h2><p>{t(stop.story,stop.storyZh)}</p>
        {!arcade && step === 0 && <>
          <label>{t("Your name", "你的姓名")}<input autoFocus required maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>
          <label>{t("Email or phone", "邮箱或手机号")}<input required maxLength={150} value={contact} onChange={e=>setContact(e.target.value)}/></label>
        </>}
        {!arcade && step === 1 && <>
          {names.map((guest,i)=><label key={i}>{i === 0 && !invitation && name ? name : guest.name} · {t("Will you attend?", "是否出席？")}<select required value={guests[i].status === "pending" ? "" : guests[i].status} onChange={e=>setGuests(guests.map((g,j)=>j===i?{...g,status:e.target.value as "yes"|"no"}:g))}><option value="">{t("Please choose", "请选择")}</option><option value="yes">{t("Joyfully attending","会出席")}</option><option value="no">{t("Unable to attend","无法出席")}</option></select></label>)}
          {attends && <><label>{t("Will you bring a plus-one?", "会带一位同行宾客（+1）吗？")}<select required value={companion.status==="pending"?"":companion.status} onChange={e=>setCompanion({...companion,status:e.target.value as "yes"|"no"})}><option value="">{t("Please choose","请选择")}</option><option value="yes">{t("Yes","会")}</option><option value="no">{t("No","不会")}</option></select></label>{companion.status==="yes"&&<label>{t("Plus-one name","同行宾客姓名")}<input required maxLength={100} value={companion.name} onChange={e=>setCompanion({...companion,name:e.target.value})}/></label>}</>}
        </>}
        {!arcade && step === 2 && <>{!attends && <p>{t("No dietary information needed if you’re unable to attend.", "如果无法出席，可以直接继续。")}</p>}{guests.map((guest,i)=>guest.status==="yes"&&<label key={i}>{names[i].name} · {t("Dietary needs (optional)","饮食限制（选填）")}<input maxLength={350} value={guest.dietary} onChange={e=>setGuests(guests.map((g,j)=>j===i?{...g,dietary:e.target.value}:g))}/></label>)}{attends&&companion.status==="yes"&&<label>{companion.name} · {t("Dietary needs (optional)","饮食限制（选填）")}<input maxLength={350} value={companion.dietary} onChange={e=>setCompanion({...companion,dietary:e.target.value})}/></label>}</>}
        {!arcade && step === 3 && <label>{t("A note for Maggie & Mayne (optional)","想对 Maggie 和 Mayne 说的话（选填）")}<textarea maxLength={800} value={note} onChange={e=>setNote(e.target.value)}/></label>}
        {!arcade && step === 5 && <dl className="journey-review">
          <div><dt>{t("Name & contact", "姓名与联系方式")}</dt><dd>{name} · {contact}</dd></div>
          <div><dt>{t("Attendance", "出席")}</dt><dd>{names.map((guest,i)=> <span key={i}>{guest.name} — {guests[i].status==="yes"?t("Attending","出席"):t("Unable to attend","无法出席")}</span>)}{attends && companion.status === "yes" && <span>{companion.name}</span>}</dd></div>
        </dl>}
        {error && <p role="alert">{error}</p>}
        <div className="journey-dialog-actions">
          <button type="button" className="journey-back" disabled={pending} onClick={previous}>{t("Back", "返回")}</button>
          <button className="journey-button" disabled={pending}>{pending?t("Saving…","保存中…"):arcade?(step===stops.length-1?t("See results","查看成绩"):t("Next stage","下一关")):step===stops.length-1&&canSubmit?t("Finish & RSVP","完成并提交 RSVP"):t("Continue","继续")} ▶</button>
        </div>
      </form></dialog>}
    </section>}
    {page === 3 && <section className="journey-end game-results">
      <div className="journey-end-cats"><CatArt black/><CatArt black={false}/></div><h1 tabIndex={-1}>{t("Next adventure…","下一段旅程…")}</h1>
      <p>{t("Thank you for coming along!","谢谢你陪我们走过这段旅程！")}<br/>{attends ? t("See you in April!","四月见！") : t("Sending love from Maggie & Mayne.","Maggie 和 Mayne 送上祝福。")}</p>
      {run.complete && <div className="game-scorecard">
        <p className="game-card-kicker">{t("Final score", "最终得分")}{newBest && <span className="game-newbest">{t("New best!", "新纪录！")}</span>}</p>
        <strong className="game-final">{fmt(run.score)}</strong>
        <p className="game-rank"><span>★ {run.stars}/{MAX_STARS}</span><b>{rank(run.stars, zh)}</b></p>
        <ul className="game-achievements">{achievements(results).map((a) => <li key={a.id} className={a.got ? "is-got" : ""}>
          <span aria-hidden="true">{a.got ? a.icon : "🔒"}</span><b>{zh ? a.zh : a.en}</b><small>{zh ? a.descZh : a.descEn}</small>
        </li>)}</ul>
      </div>}
      <div className="game-leaderboard">
        <h2>🏆 {t("Guest leaderboard", "宾客排行榜")}</h2>
        {board === null ? <p>{t("Loading…", "加载中…")}</p>
          : board.length === 0 ? <p>{t("No scores yet. Be the first!", "还没有人上榜，快来抢第一！")}</p>
            : <ol>{board.map((entry, i) => <li key={i} className={entry.you ? "is-you" : ""}>
              <span className="game-lb-rank">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
              <img src={entry.cat === "bride" ? "/journey-toothless-portrait.webp" : "/journey-coltball-portrait.webp"} alt="" width={24} height={24} />
              <span className="game-lb-name">{entry.name}{entry.you ? t(" (you)", "（你）") : ""}</span>
              <span className="game-lb-stars">{entry.stars}★</span>
              <b>{fmt(entry.score)}</b>
            </li>)}</ol>}
        {myRank && <p className="game-lb-note">{t(`You’re #${myRank} among all guests.`, `你目前在所有宾客中排名第 ${myRank}。`)}</p>}
        {(!token || demo) && <p className="game-lb-note">{t("Play from your personal invitation link to join the leaderboard.", "使用你的专属邀请链接游玩，就能登上排行榜。")}</p>}
      </div>
      <p role="status">{arcade?t("Score attack complete. Your RSVP is unchanged.","冲分模式结束，你的 RSVP 不受影响。"):demo?t("Demo complete. No RSVP was sent.","试玩结束，未发送 RSVP。"):closed?t("RSVP is closed.","RSVP 已截止。"):token?t("Your RSVP has been saved.","你的 RSVP 已保存。"):t("Use your personal invitation link to send your RSVP.","请用专属邀请链接提交 RSVP。")}</p>
      <div className="game-end-actions">
        <button type="button" className="journey-button" onClick={playAgain}>↻ {t("Play again for a higher score", "再玩一次，冲击高分")}</button>
        <a className="journey-button game-secondary" href="/registry">{t("Gift registry","礼物清单")}</a>
      </div>
      {token && !closed && <button className="journey-link" onClick={() => { setArcade(false); go(1); }}>{t("Edit your RSVP","修改 RSVP")}</button>}
    </section>}
  </main>;
}
