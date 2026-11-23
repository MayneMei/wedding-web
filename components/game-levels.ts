// Level design for the wedding road trip game: route geometry, hazards, scoring and achievements.

export type Point = { x: number; y: number };
export type CatId = "bride" | "groom";

// Trail segments between stops, drawn in a 1000×1000 viewBox (so 1 % of the board = 10 units).
export const route = [
  "M51 751 Q70 734 110 675",
  "M110 675 C183 675 167 482 270 435",
  "M270 435 C307 465 286 672 410 710",
  "M410 710 C481 721 470 450 560 430",
  "M560 430 C657 425 626 665 735 694",
  "M735 694 C824 718 837 465 906 449",
] as const;

export function pointOnRoute(stage: number, t: number): Point {
  const n = (route[stage].match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const u = 1 - t;
  let x: number, y: number;
  if (n.length === 6) {
    x = u * u * n[0] + 2 * u * t * n[2] + t * t * n[4];
    y = u * u * n[1] + 2 * u * t * n[3] + t * t * n[5];
  } else {
    x = u ** 3 * n[0] + 3 * u * u * t * n[2] + 3 * u * t * t * n[4] + t ** 3 * n[6];
    y = u ** 3 * n[1] + 3 * u * u * t * n[3] + 3 * u * t * t * n[5] + t ** 3 * n[7];
  }
  return { x: x / 10, y: y / 10 };
}

export const clampY = (y: number) => Math.min(86, Math.max(19, y));

// The 3D world lies flat on the x/z plane: 1 unit = 1 % of the map's width, and the map is 75 % as deep as it is wide.
export type Vec = { x: number; z: number };
export const DEPTH = .75;
export const toWorld = (p: Point): Vec => ({ x: p.x, z: p.y * DEPTH });

export type HazardMotion = "bob" | "sway" | "orbit" | "chase";
export type HazardKind = "yarn" | "crab" | "pigeon" | "robot" | "seal" | "boss";
// amp: world units of travel (chase: how close you must be before it chases). speed: radians/s (chase: units/s).
// hp: hits it takes to defeat (paw swipe, bouquet or dash). points: score for defeating it.
export type HazardDef = {
  kind: HazardKind; icon: string; t: number; motion: HazardMotion; amp: number; speed: number;
  hp: number; points: number; en: string; zh: string; off?: number; phase?: number;
};
export type PowerKind = "speed" | "shield" | "bouquet";
export type PowerDef = { kind: PowerKind; t: number; off: number };
export type StageDef = { hearts: number; hazards: HazardDef[]; powers: PowerDef[]; bonus: { t: number; off: number } };

type Extra = Partial<Pick<HazardDef, "off" | "phase">>;
const yarn = (t: number, motion: HazardMotion, amp: number, speed: number, extra: Extra = {}): HazardDef =>
  ({ kind: "yarn", icon: "🧶", t, motion, amp, speed, hp: 1, points: 100, en: "yarn ball", zh: "毛线球", ...extra });
const crab = (t: number, amp: number, speed: number, extra: Extra = {}): HazardDef =>
  ({ kind: "crab", icon: "🦀", t, motion: "sway", amp, speed, hp: 2, points: 150, en: "crab", zh: "螃蟹", ...extra });
const pigeon = (t: number, amp: number, speed: number, extra: Extra = {}): HazardDef =>
  ({ kind: "pigeon", icon: "🐦", t, motion: "orbit", amp, speed, hp: 1, points: 150, en: "plaza pigeon", zh: "广场鸽", ...extra });
const robot = (t: number, amp: number, speed: number, extra: Extra = {}): HazardDef =>
  ({ kind: "robot", icon: "🤖", t, motion: "chase", amp, speed, hp: 3, points: 300, en: "robot vacuum", zh: "扫地机器人", ...extra });
const seal = (t: number, amp: number, speed: number, extra: Extra = {}): HazardDef =>
  ({ kind: "seal", icon: "🦭", t, motion: "sway", amp, speed, hp: 3, points: 250, en: "sea lion", zh: "海狮", ...extra });
const boss: HazardDef = {
  kind: "boss", icon: "👑", t: .58, motion: "chase", amp: 30, speed: 7.2, hp: 8, points: 1000,
  en: "Boss: the Roomba King", zh: "Boss：扫地机器人大王",
};

export const stageDefs: StageDef[] = [
  { hearts: 4, hazards: [yarn(.72, "bob", 2.5, 1.2, { off: 6 })], powers: [], bonus: { t: .5, off: -11 } },
  {
    hearts: 6,
    hazards: [yarn(.58, "bob", 6, 1.7), yarn(.3, "sway", 4, 1.4, { off: -6 })],
    powers: [{ kind: "bouquet", t: .18, off: 8 }],
    bonus: { t: .3, off: 12 },
  },
  {
    hearts: 6,
    hazards: [yarn(.33, "sway", 6.5, 1.5), crab(.72, 4.5, 3), crab(.5, 3.5, 2.4, { off: -9, phase: 2 })],
    powers: [{ kind: "speed", t: .52, off: 9 }, { kind: "bouquet", t: .2, off: -8 }],
    bonus: { t: .6, off: -14 },
  },
  {
    hearts: 7,
    hazards: [pigeon(.45, 6, 1.9), pigeon(.62, 4.5, -2.3, { off: 7, phase: 2.4 }), yarn(.8, "bob", 5, 2.2)],
    powers: [{ kind: "shield", t: .28, off: -9 }, { kind: "bouquet", t: .12, off: 9 }],
    bonus: { t: .55, off: 13 },
  },
  {
    hearts: 7,
    hazards: [robot(.55, 22, 8), yarn(.25, "sway", 6, 2), crab(.82, 4, 2.8, { off: 8 })],
    powers: [{ kind: "speed", t: .72, off: -9 }, { kind: "bouquet", t: .15, off: 9 }],
    bonus: { t: .4, off: -14 },
  },
  {
    hearts: 8,
    hazards: [boss, yarn(.35, "bob", 6, 2.3), seal(.84, 5, 2.6)],
    powers: [{ kind: "shield", t: .46, off: 10 }, { kind: "bouquet", t: .14, off: -9 }, { kind: "bouquet", t: .72, off: -10 }],
    bonus: { t: .7, off: 12 },
  },
];

export const BOUQUET_AMMO = 5;

export const keepsakes = [
  ["🍁", "maple leaf", "枫叶"], ["🍋", "lemon tea", "柠檬茶"], ["🍣", "sushi", "寿司"],
  ["🥐", "croissant", "可颂"], ["🌴", "palm", "棕榈"], ["💌", "invitation", "请柬"],
] as const;

export const cats = {
  bride: { speed: 17, magnet: 3.2, stats: { speed: 5, magnet: 3, dash: 4 } },
  groom: { speed: 14, magnet: 5, stats: { speed: 3, magnet: 5, dash: 4 } },
} as const;

export const POINTS = { heart: 100, keepsake: 300, bonus: 500, power: 50, noHit: 250 } as const;
export const MAX_COMBO = 5;

export type StageResult = {
  score: number;
  stars: number;
  hearts: number;
  totalHearts: number;
  hits: number;
  bonus: boolean;
  time: number;
  timeBonus: number;
  bestCombo: number;
  kills: number;
  enemies: number;
  bossDown: boolean;
};

export function totals(results: (StageResult | undefined)[]) {
  const done = results.filter(Boolean) as StageResult[];
  return {
    score: done.reduce((sum, r) => sum + r.score, 0),
    stars: done.reduce((sum, r) => sum + r.stars, 0),
    hearts: done.reduce((sum, r) => sum + r.hearts, 0),
    totalHearts: stageDefs.reduce((sum, s) => sum + s.hearts, 0),
    hits: done.reduce((sum, r) => sum + r.hits, 0),
    bonus: done.filter((r) => r.bonus).length,
    bestCombo: Math.max(0, ...done.map((r) => r.bestCombo)),
    timeBonus: done.reduce((sum, r) => sum + r.timeBonus, 0),
    kills: done.reduce((sum, r) => sum + (r.kills ?? 0), 0),
    enemies: stageDefs.reduce((sum, s) => sum + s.hazards.length, 0),
    boss: done.some((r) => r.bossDown),
    complete: done.length === stageDefs.length,
  };
}

export const MAX_STARS = stageDefs.length * 3;

export function rank(stars: number, zh: boolean) {
  const ranks: [number, string, string][] = [
    [18, "Guest of Honor", "婚礼最佳宾客"],
    [15, "Legendary Cat", "传奇猫猫"],
    [11, "Adventure Cat", "冒险家猫猫"],
    [6, "Curious Cat", "好奇猫猫"],
    [0, "Wandering Kitten", "流浪小猫"],
  ];
  const found = ranks.find(([min]) => stars >= min) ?? ranks[ranks.length - 1];
  return zh ? found[2] : found[1];
}

export function achievements(results: (StageResult | undefined)[]) {
  const all = totals(results);
  return [
    { id: "hearts", icon: "💗", en: "Heart Collector", zh: "收心达人", descEn: "Collect every heart", descZh: "收集全部爱心", got: all.complete && all.hearts === all.totalHearts },
    { id: "nohit", icon: "🛡️", en: "Untouchable", zh: "毫发无伤", descEn: "Finish without getting hit", descZh: "全程不被撞到", got: all.complete && all.hits === 0 },
    { id: "bonus", icon: "⭐", en: "Treasure Hunter", zh: "寻宝猫", descEn: "Find all 6 hidden stars", descZh: "找到全部 6 颗隐藏星星", got: all.bonus === stageDefs.length },
    { id: "combo", icon: "🔥", en: "Combo Cat", zh: "连击王", descEn: `Reach a ×${MAX_COMBO} combo`, descZh: `达成 ×${MAX_COMBO} 连击`, got: all.bestCombo >= MAX_COMBO },
    { id: "speed", icon: "⚡", en: "Zoomies", zh: "飞毛腿", descEn: "Earn 1,500 time bonus", descZh: "时间奖励累计 1,500", got: all.timeBonus >= 1500 },
    { id: "pests", icon: "🐾", en: "Pest Control", zh: "清场高手", descEn: "Defeat every critter", descZh: "打倒所有捣蛋鬼", got: all.complete && all.kills === all.enemies },
    { id: "boss", icon: "🤖", en: "Boss Slayer", zh: "屠龙猫", descEn: "Defeat the Roomba King", descZh: "打倒扫地机器人大王", got: all.boss },
    { id: "perfect", icon: "👑", en: "Perfect Run", zh: "完美通关", descEn: `All ${MAX_STARS} stars`, descZh: `集齐 ${MAX_STARS} 颗星`, got: all.stars === MAX_STARS },
  ];
}

const bestKey = "wedding-game-best";
export function readBest(): { score: number; stars: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(bestKey) ?? "null") as { score?: unknown; stars?: unknown } | null;
    if (saved && typeof saved.score === "number" && typeof saved.stars === "number") return { score: saved.score, stars: saved.stars };
  } catch { /* Storage is optional. */ }
  return { score: 0, stars: 0 };
}
export function saveBest(score: number, stars: number) {
  const best = readBest();
  const next = { score: Math.max(best.score, score), stars: Math.max(best.stars, stars) };
  try { localStorage.setItem(bestKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  return next;
}
