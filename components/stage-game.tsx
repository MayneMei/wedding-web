"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "./game-audio";
import {
  MAX_COMBO, POINTS, cats, clampY, keepsakes, pointOnRoute, stageDefs,
  type CatId, type Point, type StageResult,
} from "./game-levels";

type Props = {
  stage: number;
  paused: boolean;
  zh: boolean;
  cat: CatId;
  catImg: string;
  title: string;
  start: Point;
  goal: Point;
  onClear: (result: StageResult) => void;
  children: React.ReactNode;
};
type Phase = "intro" | "count" | "play" | "clear" | "over";

const MAX_LIVES = 3;
const directions: { [key: string]: Point } = {
  ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
};
const fmt = (n: number) => n.toLocaleString("en-US");

export function StageGame({ stage, paused, zh, cat, catImg, title, start, goal, onClear, children }: Props) {
  const t = (en: string, cn: string) => zh ? cn : en;
  const def = stageDefs[stage];
  const stats = cats[cat];
  const [icon, keepsakeEn, keepsakeZh] = keepsakes[stage];

  const layout = useMemo(() => ({
    hearts: Array.from({ length: def.hearts }, (_, k) => pointOnRoute(stage, .12 + .76 * (k + .5) / def.hearts)),
    item: { x: (start.x + goal.x) / 2, y: Math.min(79, (start.y + goal.y) / 2 + (stage % 2 ? 9 : -10)) },
    bonus: (() => { const p = pointOnRoute(stage, def.bonus.t); return { x: p.x, y: clampY(p.y + def.bonus.off) }; })(),
    powers: def.powers.map((power) => { const p = pointOnRoute(stage, power.t); return { ...power, x: p.x, y: clampY(p.y + power.off) }; }),
    hazards: def.hazards.map((hazard) => ({ ...hazard, home: pointOnRoute(stage, hazard.t) })),
  }), [def, stage, start.x, start.y, goal.x, goal.y]);

  const board = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLDivElement>(null);
  const pickup = useRef<HTMLButtonElement>(null);
  const scoreEl = useRef<HTMLElement>(null);
  const timeEl = useRef<HTMLElement>(null);
  const comboEl = useRef<HTMLElement>(null);
  const dashEl = useRef<HTMLButtonElement>(null);
  const heartEls = useRef<(HTMLSpanElement | null)[]>([]);
  const powerEls = useRef<(HTMLSpanElement | null)[]>([]);
  const hazardEls = useRef<(HTMLDivElement | null)[]>([]);
  const bonusEl = useRef<HTMLSpanElement>(null);
  const keys = useRef(new Set<string>());
  const target = useRef<Point | null>(null);
  const dashRequest = useRef(false);
  const dragging = useRef(false);

  const [phase, setPhase] = useState<Phase>(stage === 0 ? "intro" : "count");
  const phaseRef = useRef(phase);
  const [attempt, setAttempt] = useState(0);
  const [count, setCount] = useState(3);
  const [lives, setLives] = useState(MAX_LIVES);
  const [carrying, setCarrying] = useState(false);
  const [tangled, setTangled] = useState(false);
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<StageResult | null>(null);
  const clear = useRef(onClear);
  const say = useRef(t);
  useEffect(() => {
    phaseRef.current = phase;
    clear.current = onClear;
    say.current = t;
  });

  function begin() {
    setCount(3);
    setPhase("count");
  }
  function retry() {
    sfx.select();
    setResult(null);
    setLives(MAX_LIVES); setCarrying(false); setTangled(false); setHint(false);
    setAttempt((a) => a + 1);
    begin();
  }

  // 3‑2‑1‑GO countdown.
  useEffect(() => {
    if (phase !== "count" || paused) return;
    sfx.count();
    let n = 3;
    const timer = window.setInterval(() => {
      n -= 1;
      setCount(n);
      sfx.count(n === 0);
      if (n < 0) { window.clearInterval(timer); phaseRef.current = "play"; setPhase("play"); }
    }, 600);
    return () => window.clearInterval(timer);
  }, [phase, paused, attempt]);

  // Main game loop.
  useEffect(() => {
    if (paused) return;
    const world = board.current!, catEl = sprite.current!, viewport = world.parentElement!;
    const held = keys.current;
    const s = {
      p: { ...start }, got: false, done: false, dir: { x: 1, y: 0 },
      hearts: layout.hearts.map(() => false), powers: layout.powers.map(() => false), bonus: false,
      score: 0, combo: 0, comboTimer: 0, bestCombo: 0, hits: 0, lives: MAX_LIVES,
      inv: 0, speedT: 0, shieldT: 0, dashT: 0, dashCd: 0, time: 0, age: 0, hinted: false,
      chase: layout.hazards.map((h) => ({ ...h.home })),
    };
    heartEls.current.forEach((el) => el?.classList.remove("is-taken"));
    powerEls.current.forEach((el) => el?.classList.remove("is-taken"));
    bonusEl.current?.classList.remove("is-taken");
    catEl.className = "journey-traveler";
    if (scoreEl.current) scoreEl.current.textContent = "0";
    target.current = null;
    dashRequest.current = false;

    let frame = 0, last = 0;

    function pop(x: number, y: number, text: string, kind = "") {
      const el = document.createElement("span");
      el.className = "game-pop " + kind;
      el.textContent = text;
      el.style.left = x + "%";
      el.style.top = y + "%";
      el.addEventListener("animationend", () => el.remove());
      world.appendChild(el);
    }
    function burst(x: number, y: number, symbol: string) {
      for (let i = 0; i < 7; i++) {
        const el = document.createElement("span");
        const angle = (Math.PI * 2 * i) / 7 + Math.random() * .5;
        el.className = "game-spark";
        el.textContent = symbol;
        el.style.left = x + "%";
        el.style.top = y + "%";
        el.style.setProperty("--dx", Math.cos(angle) * (34 + Math.random() * 26) + "px");
        el.style.setProperty("--dy", Math.sin(angle) * (34 + Math.random() * 26) + "px");
        el.addEventListener("animationend", () => el.remove());
        world.appendChild(el);
      }
    }
    function addScore(points: number) {
      s.score += points;
      if (scoreEl.current) {
        scoreEl.current.textContent = fmt(s.score);
        scoreEl.current.classList.remove("is-bump");
        void scoreEl.current.offsetWidth;
        scoreEl.current.classList.add("is-bump");
      }
    }
    function showCombo() {
      if (!comboEl.current) return;
      comboEl.current.textContent = s.combo > 1 ? `×${s.combo} COMBO` : "";
      comboEl.current.dataset.level = String(s.combo);
    }

    function key(e: KeyboardEvent, down: boolean) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ((k === " " || k === "Shift") && phaseRef.current === "play") {
        e.preventDefault();
        if (down && !e.repeat) dashRequest.current = true;
        return;
      }
      if (!directions[k]) return;
      if (phaseRef.current !== "play") return;
      e.preventDefault();
      if (down) { held.add(k); target.current = null; } else held.delete(k);
    }
    const press = (e: KeyboardEvent) => key(e, true), release = (e: KeyboardEvent) => key(e, false);
    const blur = () => { held.clear(); target.current = null; };

    function hit(from: Point, w: number, h: number) {
      s.lives -= 1; s.hits += 1; s.inv = 1.4; s.combo = 0; showCombo();
      setLives(s.lives);
      sfx.hit();
      const dx = (s.p.x - from.x) * w / 100, dy = (s.p.y - from.y) * h / 100;
      const len = Math.hypot(dx, dy) || 1;
      s.p.x = Math.min(98, Math.max(2, s.p.x + dx / len * 55 / w * 100));
      s.p.y = Math.min(88, Math.max(15, s.p.y + dy / len * 55 / h * 100));
      target.current = null;
      world.classList.remove("is-shaking"); void world.offsetWidth; world.classList.add("is-shaking");
      pop(s.p.x, s.p.y - 6, s.lives > 0 ? say.current("Ouch!", "哎呀！") : "💫", "is-bad");
      if (s.got) { s.got = false; setCarrying(false); setTangled(true); }
      if (s.lives <= 0) {
        s.done = true;
        sfx.over();
        phaseRef.current = "over";
        setPhase("over");
      }
    }

    function finish(w: number, h: number) {
      s.done = true;
      let length = 0;
      let prev = pointOnRoute(stage, 0);
      for (let i = 1; i <= 20; i++) {
        const q = pointOnRoute(stage, i / 20);
        length += Math.hypot((q.x - prev.x) * w / 100, (q.y - prev.y) * h / 100);
        prev = q;
      }
      const par = 3 + length / (stats.speed * .55) + layout.hearts.length * .35;
      const timeBonus = Math.max(0, Math.round((par - s.time) * 30));
      const hearts = s.hearts.filter(Boolean).length;
      const noHit = s.hits === 0 ? POINTS.noHit : 0;
      const r: StageResult = {
        score: s.score + timeBonus + noHit,
        stars: 1 + (hearts === layout.hearts.length ? 1 : 0) + (s.hits === 0 ? 1 : 0),
        hearts, totalHearts: layout.hearts.length, hits: s.hits, bonus: s.bonus,
        time: Math.round(s.time * 10) / 10, timeBonus, bestCombo: s.bestCombo,
      };
      burst(goal.x, goal.y, "🎉");
      sfx.clear();
      catEl.classList.remove("is-walking");
      setResult(r);
      phaseRef.current = "clear";
      setPhase("clear");
    }

    function tick(time: number) {
      const dt = Math.min((time - (last || time)) / 1000, .1);
      last = time;
      s.age += dt;
      const w = world.clientWidth, h = world.clientHeight;
      const p = s.p;
      const playing = phaseRef.current === "play" && !s.done;

      // Keepsake bobbing.
      const bait = { x: layout.item.x, y: layout.item.y + Math.sin(s.age * 1.7) * Math.min(1.4, 650 / h) };
      if (pickup.current) pickup.current.style.top = bait.y + "%";

      // Hazards move whether or not the guest is moving.
      const hazardPos = layout.hazards.map((hz, i) => {
        const phaseShift = i * 1.3;
        let x = hz.home.x, y = hz.home.y;
        if (hz.motion === "bob") y += Math.sin(s.age * hz.speed + phaseShift) * hz.amp / h * 100;
        if (hz.motion === "sway") x += Math.sin(s.age * hz.speed + phaseShift) * hz.amp / w * 100;
        if (hz.motion === "orbit") {
          x += Math.cos(s.age * hz.speed + phaseShift) * hz.amp / w * 100;
          y += Math.sin(s.age * hz.speed + phaseShift) * hz.amp / h * 100;
        }
        if (hz.motion === "chase") {
          const c = s.chase[i];
          const toP = { x: (p.x - c.x) * w / 100, y: (p.y - c.y) * h / 100 };
          const dist = Math.hypot(toP.x, toP.y);
          const home = { x: (hz.home.x - c.x) * w / 100, y: (hz.home.y - c.y) * h / 100 };
          const homeDist = Math.hypot(home.x, home.y);
          let v = { x: 0, y: 0 };
          if (playing && dist < hz.amp && s.shieldT <= 0) v = { x: toP.x / dist * hz.speed, y: toP.y / dist * hz.speed };
          else if (playing && dist < hz.amp) v = { x: -toP.x / dist * hz.speed * .8, y: -toP.y / dist * hz.speed * .8 };
          else if (homeDist > 2) v = { x: home.x / homeDist * hz.speed * .6, y: home.y / homeDist * hz.speed * .6 };
          c.x += v.x * dt / w * 100;
          c.y = clampY(c.y + v.y * dt / h * 100);
          x = c.x; y = c.y;
          hazardEls.current[i]?.style.setProperty("--face", v.x < 0 ? "-1" : "1");
        }
        const el = hazardEls.current[i];
        if (el) { el.style.left = x + "%"; el.style.top = y + "%"; }
        return { x, y };
      });

      let len = 0;
      if (playing) {
        s.time += dt;
        if (timeEl.current) timeEl.current.textContent = s.time.toFixed(1);
        s.inv = Math.max(0, s.inv - dt);
        s.speedT = Math.max(0, s.speedT - dt);
        s.shieldT = Math.max(0, s.shieldT - dt);
        s.dashT = Math.max(0, s.dashT - dt);
        s.dashCd = Math.max(0, s.dashCd - dt);
        s.comboTimer = Math.max(0, s.comboTimer - dt);
        if (s.comboTimer === 0 && s.combo) { s.combo = 0; showCombo(); }

        let dx = 0, dy = 0;
        held.forEach((k) => { dx += directions[k].x; dy += directions[k].y; });
        let speed = stats.speed * (s.speedT > 0 ? 1.45 : 1) * dt;
        if (target.current) {
          dx = (target.current.x - p.x) * w / 100;
          dy = (target.current.y - p.y) * h / 100;
          speed = Math.min(speed, Math.hypot(dx, dy));
          if (speed < .05) target.current = null;
        }
        len = Math.hypot(dx, dy);
        if (len) s.dir = { x: dx / len, y: dy / len };
        if (dashRequest.current) {
          dashRequest.current = false;
          if (s.dashCd <= 0) { s.dashT = .2; s.dashCd = 1.1; sfx.dash(); target.current = null; }
        }
        if (s.dashT > 0) { dx = s.dir.x; dy = s.dir.y; len = 1; speed = stats.speed * 3 * dt; }
        if (len) {
          p.x = Math.min(98, Math.max(2, p.x + dx / len * speed / w * 100));
          p.y = Math.min(88, Math.max(15, p.y + dy / len * speed / h * 100));
          if (Math.abs(dx) > .01) catEl.style.setProperty("--face", dx < 0 ? "-1" : "1");
        }

        const near = (q: Point, r: number) => Math.hypot((q.x - p.x) * w / 100, (q.y - p.y) * h / 100) < r;

        layout.hearts.forEach((heart, i) => {
          if (s.hearts[i] || !near(heart, stats.magnet)) return;
          s.hearts[i] = true;
          heartEls.current[i]?.classList.add("is-taken");
          s.combo = Math.min(MAX_COMBO, s.combo + 1);
          s.bestCombo = Math.max(s.bestCombo, s.combo);
          s.comboTimer = 2.2;
          addScore(POINTS.heart * s.combo);
          pop(heart.x, heart.y - 4, `+${POINTS.heart * s.combo}${s.combo > 1 ? " ×" + s.combo : ""}`);
          burst(heart.x, heart.y, "♥");
          sfx.heart(s.combo);
          showCombo();
        });
        layout.powers.forEach((power, i) => {
          if (s.powers[i] || !near(power, stats.magnet + 4)) return;
          s.powers[i] = true;
          powerEls.current[i]?.classList.add("is-taken");
          if (power.kind === "speed") s.speedT = 5; else s.shieldT = 6;
          addScore(POINTS.power);
          pop(power.x, power.y - 4, power.kind === "speed" ? say.current("Speed up!", "加速！") : say.current("Shield!", "护盾！"), "is-power");
          sfx.power();
        });
        if (!s.bonus && near(layout.bonus, stats.magnet + 4)) {
          s.bonus = true;
          bonusEl.current?.classList.add("is-taken");
          addScore(POINTS.bonus);
          pop(layout.bonus.x, layout.bonus.y - 4, `★ +${POINTS.bonus}`, "is-gold");
          burst(layout.bonus.x, layout.bonus.y, "✦");
          sfx.star();
        }
        if (!s.got && near(bait, 34)) {
          s.got = true;
          setCarrying(true); setTangled(false); setHint(false);
          addScore(POINTS.keepsake);
          pop(bait.x, bait.y - 5, `${icon} +${POINTS.keepsake}`, "is-gold");
          sfx.keepsake();
        }
        if (s.inv <= 0 && s.shieldT <= 0 && s.dashT <= 0) {
          const struck = hazardPos.find((q) => near(q, 30));
          if (struck) hit(struck, w, h);
        }
        if (!s.done && near(goal, 26)) {
          if (s.got) finish(w, h);
          else if (!s.hinted) { s.hinted = true; setHint(true); }
        } else s.hinted = false;

        catEl.classList.toggle("is-hurt", s.inv > 0);
        catEl.classList.toggle("is-shielded", s.shieldT > 0);
        catEl.classList.toggle("is-fast", s.speedT > 0 || s.dashT > 0);
        if (dashEl.current) dashEl.current.style.setProperty("--cool", String(s.dashCd / 1.1));
      }
      catEl.classList.toggle("is-walking", len > .1);
      catEl.style.left = p.x + "%";
      catEl.style.top = p.y + "%";
      if (len || s.age < .1) viewport.scrollLeft = p.x * w / 100 - viewport.clientWidth / 2;
      frame = requestAnimationFrame(tick);
    }

    window.addEventListener("keydown", press);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", blur);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", blur);
      blur();
    };
    // `t` and `stats` are derived from props already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, attempt, layout, stage]);

  function aim(e: React.PointerEvent<HTMLDivElement>) {
    if (phaseRef.current !== "play") return;
    const r = e.currentTarget.getBoundingClientRect();
    target.current = { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 };
  }

  const objective = carrying
    ? t("Deliver it to " + title + " ⚑", "送到" + title + " ⚑")
    : tangled ? t(`Tangled! Grab the ${keepsakeEn} again`, `被撞掉了！再去拿${keepsakeZh}`)
      : hint ? t(`First grab the ${keepsakeEn} ${icon}`, `先去拿${keepsakeZh} ${icon}`)
        : t(`Find the ${keepsakeEn} ${icon}`, `寻找${keepsakeZh} ${icon}`);
  const newHazards = def.hazards.filter((hz, i, all) => all.findIndex((x) => x.icon === hz.icon) === i
    && !stageDefs.slice(0, stage).some((prev) => prev.hazards.some((x) => x.icon === hz.icon)));

  return <>
    <div className="game-topbar" role="status">
      <span className="game-stage"><i>{t("Stage", "关卡")} </i>{stage + 1}/6 · <b>{title}</b></span>
      <span className="game-lives" aria-label={t(`${lives} lives`, `${lives} 条命`)}>
        {Array.from({ length: MAX_LIVES }, (_, i) => <i key={i} className={i < lives ? "" : "is-lost"}>♥</i>)}
      </span>
      <span className="game-score"><small>{t("Score", "分数")}</small><b ref={scoreEl}>0</b></span>
      <span className="game-time"><small>{t("Time", "时间")}</small><b ref={timeEl}>0.0</b></span>
      <span className="game-combo" ref={comboEl} aria-hidden="true" />
    </div>
    <div className="journey-viewport"><div className="journey-board game-board" ref={board}
      onPointerDown={(e) => { dragging.current = true; aim(e); }}
      onPointerMove={(e) => { if (dragging.current) aim(e); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}>
      {children}
      {layout.hearts.map((heart, i) => <span key={i} className="game-heart" aria-hidden="true"
        ref={(el) => { heartEls.current[i] = el; }} style={{ left: heart.x + "%", top: heart.y + "%", animationDelay: i * .15 + "s" }}>♥</span>)}
      <span className="game-bonus" ref={bonusEl} aria-hidden="true" style={{ left: layout.bonus.x + "%", top: layout.bonus.y + "%" }}>⭐</span>
      {layout.powers.map((power, i) => <span key={i} className="game-power" aria-hidden="true" data-kind={power.kind}
        ref={(el) => { powerEls.current[i] = el; }} style={{ left: power.x + "%", top: power.y + "%" }}>{power.kind === "speed" ? "🐟" : "🌿"}</span>)}
      {layout.hazards.map((hz, i) => <div key={i} className="game-hazard" aria-hidden="true" data-motion={hz.motion}
        ref={(el) => { hazardEls.current[i] = el; }} style={{ left: hz.home.x + "%", top: hz.home.y + "%" }}><span>{hz.icon}</span></div>)}
      <button type="button" className="game-dock" aria-label={title} style={{ left: goal.x + "%", top: goal.y + "%" }}
        onClick={(e) => { e.stopPropagation(); if (phase === "play") target.current = goal; }}>⚑</button>
      {!carrying && <button type="button" className="game-item" ref={pickup} style={{ left: layout.item.x + "%", top: layout.item.y + "%" }}
        aria-label={t(keepsakeEn, keepsakeZh)} onClick={(e) => { e.stopPropagation(); if (phase === "play") target.current = layout.item; }}>{icon}</button>}
      <div className="journey-traveler" ref={sprite} style={{ left: start.x + "%", top: start.y + "%" }}>
        <img alt="" className="journey-cat-art" src={catImg} />
        {carrying && <span className="game-carry" aria-hidden="true">{icon}</span>}
      </div>
    </div></div>
    <div className="journey-map-footer game-hud" role="status">
      <div className="passport">{keepsakes.map(([symbol, name], i) => <span key={name} className={i < stage || (i === stage && carrying) ? "stamped" : ""}>{i <= stage ? symbol : "·"}</span>)}</div>
      <strong>{objective}</strong>
    </div>
    <button type="button" className="game-dash" ref={dashEl} aria-label={t("Dash", "冲刺")}
      onPointerDown={(e) => { e.preventDefault(); dashRequest.current = true; }}>
      <span>{t("DASH", "冲刺")}</span><small>{t("Space", "空格")}</small>
    </button>

    {phase === "intro" && !paused && <div className="game-overlay">
      <div className="game-card">
        <p className="game-card-kicker">{t("How to play", "玩法说明")}</p>
        <h2>{t("Ready, kitty?", "准备好了吗？")}</h2>
        <ul className="game-howto">
          <li><b>🕹️</b>{t("Move with WASD / arrow keys, or press and drag on the map.", "用 WASD / 方向键移动，或在地图上按住拖动。")}</li>
          <li><b>♥</b>{t("Collect hearts along the trail. Grab them quickly to build a combo.", "沿途收集爱心，连续收集可以触发连击加分。")}</li>
          <li><b>{icon}</b>{t("Pick up the keepsake and deliver it to the ⚑ flag to clear the stage.", "拿到纪念物，送到 ⚑ 旗标就能过关。")}</li>
          <li><b>💨</b>{t("Dash with Space or the DASH button. You can't be hit while dashing.", "按空格或「冲刺」按钮冲刺，冲刺时无敌。")}</li>
          <li><b>⭐</b>{t("Each stage hides a bonus star. Look for 🐟 speed and 🌿 shield power-ups too.", "每关都藏着一颗星星，还有 🐟 加速和 🌿 护盾道具。")}</li>
          <li><b>3 ♥</b>{t("You have 3 lives per stage. Clear stages with no hits and every heart for 3 stars.", "每关 3 条命。不被撞到并收集全部爱心可获得 3 星。")}</li>
        </ul>
        <button type="button" className="journey-button game-go" autoFocus onClick={() => { sfx.start(); begin(); }}>{t("Let’s go!", "出发！")} ▶</button>
      </div>
    </div>}

    {phase === "count" && !paused && <div className="game-overlay is-clear-through">
      <div className="game-count">
        <p>{t("Stage", "第")} {stage + 1}{zh ? " 关" : ""} · {title}</p>
        {newHazards.length > 0 && <p className="game-warning">{t("Watch out", "小心")}: {newHazards.map((hz) => `${hz.icon} ${zh ? hz.zh : hz.en}`).join(" · ")}</p>}
        <strong key={count}>{count > 0 ? count : "GO!"}</strong>
      </div>
    </div>}

    {phase === "over" && <div className="game-overlay">
      <div className="game-card game-card-center">
        <p className="game-card-kicker">{t("Out of lives", "生命耗尽")}</p>
        <h2>🙀 {t("Try again!", "再来一次！")}</h2>
        <p>{t("Every cat lands on its feet eventually.", "猫猫总会稳稳落地的。")}</p>
        <button type="button" className="journey-button game-go" autoFocus onClick={retry}>{t("Retry stage", "重试本关")} ↻</button>
      </div>
    </div>}

    {phase === "clear" && result && !paused && <div className="game-overlay">
      <div className="game-card game-card-center game-clear">
        <p className="game-card-kicker">{t("Stage clear!", "过关！")}</p>
        <div className="game-stars" aria-label={t(`${result.stars} of 3 stars`, `${result.stars} / 3 星`)}>
          {[0, 1, 2].map((i) => <span key={i} className={i < result.stars ? "is-on" : ""} style={{ animationDelay: .25 + i * .3 + "s" }}>★</span>)}
        </div>
        <dl className="game-tally">
          <div><dt>♥ {t("Hearts", "爱心")} {result.hearts}/{result.totalHearts}</dt><dd>{result.hearts === result.totalHearts ? "★" : ""}</dd></div>
          <div><dt>🛡️ {t("Hits taken", "被撞次数")} {result.hits}</dt><dd>{result.hits === 0 ? `+${POINTS.noHit}` : ""}</dd></div>
          <div><dt>⏱ {t("Time", "用时")} {result.time}s</dt><dd>+{fmt(result.timeBonus)}</dd></div>
          <div><dt>⭐ {t("Hidden star", "隐藏星星")}</dt><dd>{result.bonus ? "✓" : "—"}</dd></div>
          <div className="game-total"><dt>{t("Stage score", "本关得分")}</dt><dd>{fmt(result.score)}</dd></div>
        </dl>
        <div className="game-card-actions">
          <button type="button" className="journey-link" onClick={retry}>↻ {t("Replay for 3 stars", "重玩冲 3 星")}</button>
          <button type="button" className="journey-button game-go" autoFocus onClick={() => { sfx.select(); clear.current(result); }}>{t("Continue", "继续")} ▶</button>
        </div>
      </div>
    </div>}
  </>;
}
