"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import {
  drawCat, drawMap, drawMarker, drawSnack, mapHeight, mapWidth, snacks, startCats, stops,
  type Cat, type Paint, type Point,
} from "@/lib/pixel-wedding";

const directions: { [key: string]: Point } = {
  ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowRight: [1, 0],
  w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
};
const discoveries = [...stops, ...snacks];
type Discovery = typeof discoveries[number];
const within = (value: number, max: number) => Math.min(max - 12, Math.max(12, value));
const distance = (cat: Cat, item: { x: number; y: number }) => Math.hypot(cat.x - item.x, cat.y - item.y);

function moveCat(cats: Cat[], index: number, x: number, y: number) {
  return cats.map((cat, i) => i === index ? {
    ...cat,
    x: within(x, mapWidth), y: within(y, mapHeight),
    facing: x === cat.x ? cat.facing : x > cat.x ? 1 : -1,
    step: cat.step + 1,
  } : cat);
}

function painter(context: CanvasRenderingContext2D): Paint {
  return (x, y, width, height, color) => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };
}

export default function CatAdventure({ zh }: { zh: boolean }) {
  const [cats, setCats] = useState<Cat[]>(startCats);
  const [active, setActive] = useState(0);
  const [target, setTarget] = useState<Point | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [last, setLast] = useState<Discovery>();
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const terrain = useRef<HTMLCanvasElement>(null);
  const lastContact = useRef<string | undefined>(undefined);
  const text = (en: string, cn: string) => zh ? cn : en;
  const catName = (id: number) => id ? text("White cat", "白猫") : text("Black cat", "黑猫");

  useEffect(() => {
    const base = document.createElement("canvas");
    base.width = mapWidth;
    base.height = mapHeight;
    const context = base.getContext("2d", { alpha: false });
    if (context) {
      drawMap(painter(context));
      terrain.current = base;
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const context = canvas.current?.getContext("2d", { alpha: false });
    if (!context || !terrain.current) return;
    context.imageSmoothingEnabled = false;
    context.drawImage(terrain.current, 0, 0);
    const paint = painter(context);
    for (const stop of stops) drawMarker(paint, stop.x, stop.y, visited.includes(stop.id));
    for (const snack of snacks) {
      if (!visited.includes(snack.id)) drawSnack(paint, snack.id, snack.x, snack.y);
    }
    const sorted = [...cats].sort((a, b) => a.y - b.y);
    sorted.forEach((cat) => drawCat(paint, cat, cat.id === active));
  }, [cats, active, visited, ready]);

  useEffect(() => {
    const cat = cats[active];
    const nearby = discoveries.find((item) => distance(cat, item) <= 14);
    if (lastContact.current !== nearby?.id) {
      lastContact.current = nearby?.id;
      if (nearby) {
        setLast(nearby);
        setVisited((current) => current.includes(nearby.id) ? current : [...current, nearby.id]);
      }
    }
    if (target && distance(cat, { x: target[0], y: target[1] }) < 1) setTarget(null);
  }, [active, cats, target]);

  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => {
      setCats((current) => {
        const cat = current[active];
        const dx = target[0] - cat.x, dy = target[1] - cat.y;
        const remaining = Math.hypot(dx, dy);
        if (remaining === 0) return current;
        const fraction = Math.min(1, 8 / remaining);
        return moveCat(current, active, cat.x + dx * fraction, cat.y + dy * fraction);
      });
    }, 34);
    return () => window.clearInterval(timer);
  }, [active, target]);

  function selectCat(index: number) {
    setTarget(null);
    setActive(index);
  }

  function walk([dx, dy]: Point) {
    setTarget(null);
    setCats((current) => {
      const cat = current[active];
      return moveCat(current, active, cat.x + dx * 10, cat.y + dy * 10);
    });
  }

  function headTo(x: number, y: number) {
    const point: Point = [within(x, mapWidth), within(y, mapHeight)];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTarget(null);
      setCats((current) => moveCat(current, active, ...point));
    } else setTarget(point);
  }

  function clickMap(event: MouseEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * mapWidth / bounds.width;
    const y = (event.clientY - bounds.top) * mapHeight / bounds.height;
    const selected = discoveries.find((item) => distance({ ...cats[active], x, y }, item) < 20);
    if (selected) headTo(selected.x, selected.y);
    else headTo(x, y);
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (directions[key]) {
      event.preventDefault();
      walk(directions[key]);
    } else if (key === "c" && !event.repeat) selectCat(1 - active);
  }

  const foundStops = stops.filter(({ id }) => visited.includes(id)).length;
  const foundFood = snacks.filter(({ id }) => visited.includes(id)).length;
  const showFind = last
    ? <>
      {"country" in last && <span className="map-country">{zh ? last.countryZh : last.country}</span>}
      <strong>{zh ? last.zh : last.en}</strong>
      <span>{zh ? last.noteZh : last.note}</span>
    </>
    : <><strong>{text("Where to first?", "先去哪儿？")}</strong><span>{text("Choose a cat and tap the map, or move with the arrow keys.", "选一只猫，再轻点地图或用方向键移动。")}</span></>;

  return <section className="adventure" aria-labelledby="adventure-title">
    <div className="game-titlebar">
      <h2 id="adventure-title">{text("The Wedding Map", "婚礼小地图")}</h2>
      <div className="game-counts" aria-label={text("Exploration progress", "探索进度")}>
        <span>{text("Places", "地标")} <strong>{foundStops}/5</strong></span>
        <span>{text("Snacks", "食物")} <strong>{foundFood}/2</strong></span>
      </div>
    </div>
    <canvas ref={canvas} width={mapWidth} height={mapHeight} className="game-canvas" tabIndex={0}
      aria-label={text("Pixel map. Arrow keys or W A S D to move, C to switch cats. Select a destination below to walk there.", "像素地图。方向键或 W A S D 移动，C 键切换猫。也可以在下方选择目的地。")}
      onClick={clickMap} onKeyDown={keyDown} />
    <div className="game-panel">
      <div className="game-control">
        <span className="game-label">{text("Play as", "选择猫咪")}</span>
        <div className="cat-buttons">
          {cats.map(({ id }) => <button key={id} type="button" className="cat-choice" aria-pressed={active === id} onClick={() => selectCat(id)}>
            <img src={id === 0 ? "/black-cat.png" : "/white-cat.png"} alt="" width={20} height={18} />
            <span>{catName(id)}</span>
          </button>)}
        </div>
      </div>
      <div className="game-control move-control">
        <span className="game-label">{text("Move", "移动")}</span>
        <div className="move-buttons">
          {([
            ["ArrowLeft", "←", "Left", "左"], ["ArrowUp", "↑", "Up", "上"],
            ["ArrowDown", "↓", "Down", "下"], ["ArrowRight", "→", "Right", "右"],
          ] as const).map(([key, icon, en, cn]) => <button key={key} type="button" onClick={() => walk(directions[key])} aria-label={text(en, cn)}>{icon}</button>)}
        </div>
      </div>
    </div>
    <div className="map-note" aria-live="polite">{showFind}</div>
    <details className="game-destinations">
      <summary>{text("Choose a destination", "选择目的地")}</summary>
      <div>
        {discoveries.map((item) => <button key={item.id} type="button" onClick={() => headTo(item.x, item.y)}>
          {zh ? item.zh : item.en}
        </button>)}
      </div>
    </details>
  </section>;
}
