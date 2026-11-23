"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "./game-audio";
import {
  DEPTH, MAX_COMBO, POINTS, cats, clampY, keepsakes, pointOnRoute, stageDefs, toWorld,
  type CatId, type Point, type StageResult, type Vec,
} from "./game-levels";
import type { World } from "./world3d";

export type StopInfo = { key: string; title: string; x: number; y: number };
type Props = {
  stage: number;
  paused: boolean;
  zh: boolean;
  cat: CatId;
  catImg: string;
  stops: StopInfo[];
  stars: (number | undefined)[];
  start: Point;
  onClear: (result: StageResult) => void;
};
type Phase = "intro" | "count" | "play" | "clear" | "over";

const MAX_LIVES = 3;
const directions: { [key: string]: Vec } = {
  ArrowUp: { x: 0, z: -1 }, w: { x: 0, z: -1 }, ArrowDown: { x: 0, z: 1 }, s: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 }, a: { x: -1, z: 0 }, ArrowRight: { x: 1, z: 0 }, d: { x: 1, z: 0 },
};
const BOUNDS = { minX: 1, maxX: 99, minZ: 15 * DEPTH, maxZ: 88 * DEPTH };
const fmt = (n: number) => n.toLocaleString("en-US");
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

export function StageGame({ stage, paused, zh, cat, catImg, stops, stars, start, onClear }: Props) {
  const t = (en: string, cn: string) => zh ? cn : en;
  const def = stageDefs[stage];
  const stats = cats[cat];
  const [icon, keepsakeEn, keepsakeZh] = keepsakes[stage];
  const goalStop = stops[stage];
  const title = goalStop.title;

  const { x: sx, y: sy } = start;
  const layout = useMemo(() => {
    const start = { x: sx, y: sy };
    const goal = { x: goalStop.x, y: goalStop.y };
    const offset = (t: number, off: number) => { const p = pointOnRoute(stage, t); return toWorld({ x: p.x, y: clampY(p.y + off) }); };
    return {
      start: toWorld(start),
      goal: toWorld(goal),
      hearts: Array.from({ length: def.hearts }, (_, k) => toWorld(pointOnRoute(stage, .12 + .76 * (k + .5) / def.hearts))),
      item: toWorld({ x: (start.x + goal.x) / 2, y: Math.min(79, (start.y + goal.y) / 2 + (stage % 2 ? 9 : -10)) }),
      bonus: offset(def.bonus.t, def.bonus.off),
      powers: def.powers.map((power) => ({ kind: power.kind, pos: offset(power.t, power.off) })),
      hazards: def.hazards.map((hazard) => ({ ...hazard, home: toWorld(pointOnRoute(stage, hazard.t)) })),
    };
  }, [def, stage, sx, sy, goalStop.x, goalStop.y]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const labelEls = useRef<(HTMLDivElement | null)[]>([]);
  const scoreEl = useRef<HTMLElement>(null);
  const timeEl = useRef<HTMLElement>(null);
  const comboEl = useRef<HTMLElement>(null);
  const dashEl = useRef<HTMLButtonElement>(null);
  const keys = useRef(new Set<string>());
  const target = useRef<Vec | null>(null);
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
  const [noWebGL, setNoWebGL] = useState(false);
  const [ready, setReady] = useState(false);
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

  // Build the 3D diorama once per stage. three.js is loaded lazily so the title screen stays light.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    import("./world3d").then(({ createWorld }) => {
      if (cancelled || !canvas.current) return;
      try {
        world.current = createWorld(canvas.current, {
          stage, stops, hearts: layout.hearts, bonus: layout.bonus, powers: layout.powers,
          hazards: layout.hazards.map((h) => ({ icon: h.icon, pos: h.home })),
          item: layout.item, itemIcon: icon, goal: layout.goal, start: layout.start, catImg,
        });
      } catch {
        setNoWebGL(true);
        return;
      }
      const el = canvas.current;
      observer = new ResizeObserver(() => world.current?.resize());
      observer.observe(el);
      setReady(true);
    }).catch(() => { if (!cancelled) setNoWebGL(true); });
    return () => { cancelled = true; observer?.disconnect(); world.current?.dispose(); world.current = null; };
    // The stage's layout is fixed for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const w = world.current;
    if (paused || !w) return;
    const overlay = layer.current!;
    const held = keys.current;
    const s = {
      p: { ...layout.start }, got: false, done: false, dir: { x: 1, z: 0 }, face: 1,
      hearts: layout.hearts.map(() => false), powers: layout.powers.map(() => false), bonus: false,
      score: 0, combo: 0, comboTimer: 0, bestCombo: 0, hits: 0, lives: MAX_LIVES,
      inv: 0, speedT: 0, shieldT: 0, dashT: 0, dashCd: 0, time: 0, age: 0, hinted: false, walking: false,
      chase: layout.hazards.map((h) => ({ ...h.home })),
      chaseFace: layout.hazards.map(() => 1),
    };
    w.reset();
    if (scoreEl.current) scoreEl.current.textContent = "0";
    target.current = null;
    dashRequest.current = false;

    let frame = 0, last = 0;

    function place(el: HTMLElement, pos: Vec, y: number) {
      const at = w!.project(pos, y);
      el.style.left = at.x + "px";
      el.style.top = at.y + "px";
    }
    function pop(pos: Vec, text: string, kind = "", y = 4) {
      const el = document.createElement("span");
      el.className = "game-pop " + kind;
      el.textContent = text;
      place(el, pos, y);
      el.addEventListener("animationend", () => el.remove());
      overlay.appendChild(el);
    }
    function burst(pos: Vec, symbol: string, y = 1.5) {
      for (let i = 0; i < 8; i++) {
        const el = document.createElement("span");
        const angle = (Math.PI * 2 * i) / 8 + Math.random() * .5;
        el.className = "game-spark";
        el.textContent = symbol;
        place(el, pos, y);
        el.style.setProperty("--dx", Math.cos(angle) * (38 + Math.random() * 28) + "px");
        el.style.setProperty("--dy", Math.sin(angle) * (38 + Math.random() * 28) + "px");
        el.addEventListener("animationend", () => el.remove());
        overlay.appendChild(el);
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
    function shake() {
      const el = canvas.current!;
      el.classList.remove("is-shaking"); void el.offsetWidth; el.classList.add("is-shaking");
    }

    function key(e: KeyboardEvent, down: boolean) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ((k === " " || k === "Shift") && phaseRef.current === "play") {
        e.preventDefault();
        if (down && !e.repeat) dashRequest.current = true;
        return;
      }
      if (!directions[k] || phaseRef.current !== "play") return;
      e.preventDefault();
      if (down) { held.add(k); target.current = null; } else held.delete(k);
    }
    const press = (e: KeyboardEvent) => key(e, true), release = (e: KeyboardEvent) => key(e, false);
    const blur = () => { held.clear(); target.current = null; };

    function hit(from: Vec) {
      s.lives -= 1; s.hits += 1; s.inv = 1.4; s.combo = 0; showCombo();
      setLives(s.lives);
      sfx.hit();
      const dx = s.p.x - from.x, dz = s.p.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      s.p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, s.p.x + dx / len * 5));
      s.p.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, s.p.z + dz / len * 5));
      target.current = null;
      shake();
      pop(s.p, s.lives > 0 ? say.current("Ouch!", "哎呀！") : "💫", "is-bad", 6);
      if (s.got) { s.got = false; setCarrying(false); setTangled(true); }
      if (s.lives <= 0) {
        s.done = true;
        sfx.over();
        phaseRef.current = "over";
        setPhase("over");
      }
    }

    function finish() {
      s.done = true;
      let length = 0;
      let prev = toWorld(pointOnRoute(stage, 0));
      for (let i = 1; i <= 20; i++) {
        const next = toWorld(pointOnRoute(stage, i / 20));
        length += dist(prev, next);
        prev = next;
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
      burst(layout.goal, "🎉", 4);
      sfx.clear();
      setResult(r);
      phaseRef.current = "clear";
      setPhase("clear");
    }

    function tick(now: number) {
      const dt = Math.min((now - (last || now)) / 1000, .1);
      last = now;
      s.age += dt;
      const p = s.p;
      const playing = phaseRef.current === "play" && !s.done;

      const hazardPos = layout.hazards.map((hz, i) => {
        const shift = i * 1.3;
        let x = hz.home.x, z = hz.home.z;
        if (hz.motion === "bob") z += Math.sin(s.age * hz.speed + shift) * hz.amp;
        if (hz.motion === "sway") { x += Math.sin(s.age * hz.speed + shift) * hz.amp; s.chaseFace[i] = Math.cos(s.age * hz.speed + shift) < 0 ? -1 : 1; }
        if (hz.motion === "orbit") {
          x += Math.cos(s.age * hz.speed + shift) * hz.amp;
          z += Math.sin(s.age * hz.speed + shift) * hz.amp * .8;
          s.chaseFace[i] = -Math.sin(s.age * hz.speed + shift) < 0 ? -1 : 1;
        }
        if (hz.motion === "chase") {
          const c = s.chase[i];
          const toP = { x: p.x - c.x, z: p.z - c.z };
          const d = Math.hypot(toP.x, toP.z) || 1;
          const home = { x: hz.home.x - c.x, z: hz.home.z - c.z };
          const homeD = Math.hypot(home.x, home.z);
          let v = { x: 0, z: 0 };
          if (playing && d < hz.amp && s.shieldT <= 0) v = { x: toP.x / d * hz.speed, z: toP.z / d * hz.speed };
          else if (playing && d < hz.amp) v = { x: -toP.x / d * hz.speed * .8, z: -toP.z / d * hz.speed * .8 };
          else if (homeD > .3) v = { x: home.x / homeD * hz.speed * .6, z: home.z / homeD * hz.speed * .6 };
          c.x += v.x * dt;
          c.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, c.z + v.z * dt));
          if (Math.abs(v.x) > .1) s.chaseFace[i] = v.x < 0 ? -1 : 1;
          x = c.x; z = c.z;
        }
        return { x, z };
      });
      const bait = layout.item;

      s.walking = false;
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

        let dx = 0, dz = 0;
        held.forEach((k) => { dx += directions[k].x; dz += directions[k].z; });
        let step = stats.speed * (s.speedT > 0 ? 1.45 : 1) * dt;
        if (target.current) {
          dx = target.current.x - p.x;
          dz = target.current.z - p.z;
          step = Math.min(step, Math.hypot(dx, dz));
          if (step < .01) target.current = null;
        }
        let len = Math.hypot(dx, dz);
        if (len) s.dir = { x: dx / len, z: dz / len };
        if (dashRequest.current) {
          dashRequest.current = false;
          if (s.dashCd <= 0) { s.dashT = .2; s.dashCd = 1.1; sfx.dash(); target.current = null; }
        }
        if (s.dashT > 0) { dx = s.dir.x; dz = s.dir.z; len = 1; step = stats.speed * 3 * dt; }
        if (len && step > 0) {
          p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x + dx / len * step));
          p.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, p.z + dz / len * step));
          if (Math.abs(dx) > .01) s.face = dx < 0 ? -1 : 1;
          s.walking = true;
        }

        const near = (q: Vec, r: number) => dist(q, p) < r;
        layout.hearts.forEach((heart, i) => {
          if (s.hearts[i] || !near(heart, stats.magnet)) return;
          s.hearts[i] = true;
          w!.hideHeart(i);
          s.combo = Math.min(MAX_COMBO, s.combo + 1);
          s.bestCombo = Math.max(s.bestCombo, s.combo);
          s.comboTimer = 2.2;
          addScore(POINTS.heart * s.combo);
          pop(heart, `+${POINTS.heart * s.combo}${s.combo > 1 ? " ×" + s.combo : ""}`);
          burst(heart, "♥");
          sfx.heart(s.combo);
          showCombo();
        });
        layout.powers.forEach((power, i) => {
          if (s.powers[i] || !near(power.pos, stats.magnet + .6)) return;
          s.powers[i] = true;
          w!.hidePower(i);
          if (power.kind === "speed") s.speedT = 5; else s.shieldT = 6;
          addScore(POINTS.power);
          pop(power.pos, power.kind === "speed" ? say.current("Speed up!", "加速！") : say.current("Shield!", "护盾！"), "is-power");
          sfx.power();
        });
        if (!s.bonus && near(layout.bonus, stats.magnet + .6)) {
          s.bonus = true;
          w!.hideBonus();
          addScore(POINTS.bonus);
          pop(layout.bonus, `★ +${POINTS.bonus}`, "is-gold");
          burst(layout.bonus, "✦", 2);
          sfx.star();
        }
        if (!s.got && near(bait, 3.4)) {
          s.got = true;
          setCarrying(true); setTangled(false); setHint(false);
          addScore(POINTS.keepsake);
          pop(bait, `${icon} +${POINTS.keepsake}`, "is-gold");
          sfx.keepsake();
        }
        if (s.inv <= 0 && s.shieldT <= 0 && s.dashT <= 0) {
          const struck = hazardPos.find((q) => near(q, 2.8));
          if (struck) hit(struck);
        }
        if (!s.done && near(layout.goal, 3)) {
          if (s.got) finish();
          else if (!s.hinted) { s.hinted = true; setHint(true); }
        } else s.hinted = false;
        if (dashEl.current) dashEl.current.style.setProperty("--cool", String(s.dashCd / 1.1));
      }

      w!.frame({
        dt,
        camera: phaseRef.current === "intro" ? "overview" : "follow",
        cat: { pos: p, face: s.face, walking: s.walking, hurt: s.inv > 0, shield: s.shieldT > 0, fast: s.speedT > 0 || s.dashT > 0, carrying: s.got },
        hazards: hazardPos,
        hazardFace: s.chaseFace,
        itemVisible: !s.got,
      });
      if (process.env.NODE_ENV !== "production") {
        // Test hook for automated play-throughs in development builds only.
        (window as unknown as { __stageTargets?: unknown }).__stageTargets = {
          item: s.got ? null : w!.project(layout.item, 0),
          goal: w!.project(layout.goal, 0),
          hearts: layout.hearts.filter((_, i) => !s.hearts[i]).map((h) => w!.project(h, 0)),
          phase: phaseRef.current,
        };
      }
      stops.forEach((stop, i) => {
        const el = labelEls.current[i];
        if (!el) return;
        const at = w!.project(toWorld(stop), 0);
        el.style.transform = `translate(${at.x}px, ${at.y}px)`;
        el.style.visibility = at.visible ? "" : "hidden";
      });
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
    // `stats`, `icon` and `stops` are fixed for this stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, attempt, layout, stage, ready]);

  function aim(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== "play" || !world.current) return;
    const at = world.current.pick(e.clientX, e.clientY);
    if (at) target.current = at;
  }

  const objective = carrying
    ? t("Deliver it to " + title + " ⚑", "送到" + title + " ⚑")
    : tangled ? t(`Tangled! Grab the ${keepsakeEn} again`, `被撞掉了！再去拿${keepsakeZh}`)
      : hint ? t(`First grab the ${keepsakeEn} ${icon}`, `先去拿${keepsakeZh} ${icon}`)
        : t(`Find the ${keepsakeEn} ${icon}`, `寻找${keepsakeZh} ${icon}`);
  const newHazards = def.hazards.filter((hz, i, all) => all.findIndex((x) => x.icon === hz.icon) === i
    && !stageDefs.slice(0, stage).some((prev) => prev.hazards.some((x) => x.icon === hz.icon)));

  return <>
    <canvas ref={canvas} className="game-canvas3d"
      aria-label={t("3D map of our story. Move with WASD or the arrow keys, or press and drag on the map. Space to dash.", "3D 故事地图。用 WASD 或方向键移动，也可以在地图上按住拖动；空格键冲刺。")}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); aim(e); }}
      onPointerMove={(e) => { if (dragging.current) aim(e); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }} />
    <div className="game-layer" ref={layer} aria-hidden="true">
      {stops.map((stop, i) => <div key={stop.key} className="game-label" ref={(el) => { labelEls.current[i] = el; }}
        data-state={i < stage ? "done" : i === stage ? "current" : "next"}>
        <span className="journey-stop-name">{i < stage ? "✓ " : `${i + 1} · `}{stop.title}</span>
        {stars[i] !== undefined && <span className="game-pin-stars">{"★".repeat(stars[i]!)}{"☆".repeat(3 - stars[i]!)}</span>}
      </div>)}
    </div>
    {noWebGL && <p className="game-nowebgl" role="alert">{t("Your browser can’t show the 3D map. Try another browser, or ask Maggie & Mayne for help with your RSVP.", "你的浏览器无法显示 3D 地图。请换一个浏览器试试，或直接联系 Maggie 和 Mayne 回复出席。")}</p>}

    <div className="game-topbar" role="status">
      <span className="game-stage"><i>{t("Stage", "关卡")} </i>{stage + 1}/6 · <b>{title}</b></span>
      <span className="game-lives" aria-label={t(`${lives} lives`, `${lives} 条命`)}>
        {Array.from({ length: MAX_LIVES }, (_, i) => <i key={i} className={i < lives ? "" : "is-lost"}>♥</i>)}
      </span>
      <span className="game-score"><small>{t("Score", "分数")}</small><b ref={scoreEl}>0</b></span>
      <span className="game-time"><small>{t("Time", "时间")}</small><b ref={timeEl}>0.0</b></span>
      <span className="game-combo" ref={comboEl} aria-hidden="true" />
    </div>
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
