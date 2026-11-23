// A storybook "paper diorama" built with three.js: the hand-drawn stickers and cats stand up as
// cut-out billboards on a paper map, surrounded by toon-shaded 3D props with navy outlines.
import * as THREE from "three";
import { DEPTH, pointOnRoute, route, toWorld, type HazardKind, type PowerKind, type Vec } from "./game-levels";
import { makePalm, makePigeon, makeVacuum, makeYarn, type Kit, type Palm, type Pigeon, type Vacuum } from "./world-critters";

export type WorldSetup = {
  stage: number;
  stops: { key: string; x: number; y: number }[];
  hearts: Vec[];
  bonus: Vec;
  powers: { kind: PowerKind; pos: Vec }[];
  hazards: { kind: HazardKind; icon: string; pos: Vec; maxHp: number }[];
  item: Vec;
  itemIcon: string;
  goal: Vec;
  start: Vec;
  catImg: string;
};

export type HazardView = { x: number; z: number; alive: boolean; hurt: boolean; stunned: boolean; hp: number; angry: boolean };
export type Frame = {
  dt: number;
  camera: "overview" | "follow";
  cat: { pos: Vec; face: number; walking: boolean; hurt: boolean; shield: boolean; fast: boolean; carrying: boolean };
  hazards: HazardView[];
  shots: { x: number; z: number; spin: number }[];
  itemVisible: boolean;
};

// Mirror a sprite's texture. (Sprites ignore negative scale, so flipping has to happen in UV space.)
function setFlip(sprite: THREE.Sprite, face: number) {
  const map = sprite.material.map;
  if (!map) return;
  const want = face < 0 ? -1 : 1;
  if (map.repeat.x !== want) { map.repeat.x = want; map.offset.x = want < 0 ? 1 : 0; }
}
const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

const W = 100, D = 100 * DEPTH;
const OUTLINE = 0x384c62;
const PAPER = "#fdfbf3";

function toonRamp() {
  const ramp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

function emojiTexture(emoji: string) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${size * .76}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size * .55);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function paperTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#a8785d55";
  for (let x = 8; x < size; x += 16) for (let y = 8; y < size; y += 16) {
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 7);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 4, bevelEnabled: true, bevelSize: 1.2, bevelThickness: 1.2, bevelSegments: 2, curveSegments: 10 });
  geo.center();
  geo.rotateZ(Math.PI);
  geo.scale(.085, .085, .085);
  return geo;
}

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? .48 : 1.15;
    const a = Math.PI / 2 + i * Math.PI / 5;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: .3, bevelEnabled: true, bevelSize: .12, bevelThickness: .12, bevelSegments: 1 });
  geo.center();
  return geo;
}

// Deterministic pseudo-random numbers so the scenery is the same for every guest.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(canvas: HTMLCanvasElement, setup: WorldSetup) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4ead6");
  scene.fog = new THREE.Fog("#f4ead6", 110, 230);
  const camera = new THREE.PerspectiveCamera(38, 1, .5, 400);

  const ramp = toonRamp();
  const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
  const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
    new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
  function outlined(geo: THREE.BufferGeometry, material: THREE.Material, thickness = 1.1) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    const hull = new THREE.Mesh(geo, outlineMat);
    hull.scale.setScalar(thickness);
    group.add(hull, mesh);
    return group;
  }
  const shadowGeo = new THREE.CircleGeometry(1, 24);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x3a2f22, transparent: true, opacity: .2, depthWrite: false });
  function blob(radius: number) {
    const mesh = new THREE.Mesh(shadowGeo, shadowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = .04;
    mesh.scale.set(radius, radius * .7, 1);
    return mesh;
  }
  const loader = new THREE.TextureLoader();
  function standee(url: string, height: number, maxWidth = Infinity) {
    const material = new THREE.SpriteMaterial({ transparent: true, alphaTest: .35 });
    const sprite = new THREE.Sprite(material);
    sprite.center.set(.5, 0);
    sprite.scale.set(height, height, 1);
    sprite.userData.w = height;
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
      material.needsUpdate = true;
      const aspect = texture.image.width / texture.image.height;
      const h = Math.min(height, maxWidth / aspect);
      sprite.userData.w = h * aspect;
      sprite.scale.set(h * aspect, h, 1);
    });
    return sprite;
  }
  const kit: Kit = { toon, outlined, blob };
  function emojiSprite(emoji: string, height: number) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, alphaTest: .2 }));
    sprite.center.set(.5, 0);
    sprite.scale.set(height, height, 1);
    return sprite;
  }

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0xfff6e2, 0xc8b48c, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.8);
  sun.position.set(W / 2 - 30, 150, D / 2 + 45);
  sun.target.position.set(W / 2, 0, D / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 50, bottom: -50, near: 40, far: 320 });
  sun.shadow.bias = -.0008;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // ---------- The paper map board ----------
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W + 8, D + 8), new THREE.MeshLambertMaterial({ map: paperTexture() }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(W / 2, 0, D / 2);
  top.receiveShadow = true;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 3, D + 8), toon("#dcc59a"));
  slab.position.set(W / 2, -1.52, D / 2);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: "#eadcbd" }));
  table.rotation.x = -Math.PI / 2;
  table.position.set(W / 2, -3.1, D / 2);
  table.receiveShadow = true;
  scene.add(top, slab, table);

  // ---------- Dotted trail ----------
  const dots: { x: number; z: number; seg: number }[] = [];
  route.forEach((_, seg) => {
    let prev = toWorld(pointOnRoute(seg, 0)), carry = 0;
    for (let i = 1; i <= 240; i++) {
      const next = toWorld(pointOnRoute(seg, i / 240));
      carry += Math.hypot(next.x - prev.x, next.z - prev.z);
      if (carry >= 1.5) { dots.push({ ...next, seg }); carry = 0; }
      prev = next;
    }
  });
  const trail = new THREE.InstancedMesh(new THREE.CircleGeometry(.36, 10), new THREE.MeshBasicMaterial(), dots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  dots.forEach((dot, i) => {
    const big = dot.seg === setup.stage ? 1.35 : 1;
    trail.setMatrixAt(i, m4.compose(new THREE.Vector3(dot.x, .05, dot.z), q, new THREE.Vector3(big, big, big)));
    trail.setColorAt(i, new THREE.Color(dot.seg < setup.stage ? "#777e58" : dot.seg === setup.stage ? "#8f3a57" : "#b9b897"));
  });
  scene.add(trail);

  // ---------- Stops: standing stickers and pins ----------
  const palms: Palm[] = [];
  const twinkles: THREE.Object3D[] = [];
  setup.stops.forEach((stop, i) => {
    const p = toWorld(stop);
    if (stop.key === "hollywood") scene.add(losAngeles(p));
    else {
      const sticker = standee(`/waypoint-${stop.key}.webp`, 13, 24);
      sticker.position.set(p.x, 0, p.z - 2.6);
      const shade = blob(6);
      shade.position.set(p.x, .04, p.z - 2.2);
      scene.add(sticker, shade);
    }
    const color = i < setup.stage ? "#394d33" : i === setup.stage ? "#8f3a57" : "#586e50";
    const pin = outlined(new THREE.CylinderGeometry(1.15, 1.25, .5, 28), toon(color), 1.12);
    pin.position.set(p.x, .25, p.z);
    scene.add(pin);
  });

  // Los Angeles in 3D: a sandy island of swaying palms in front of a setting sun.
  function losAngeles(p: Vec) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z - 3.4);
    const sand = outlined(new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon("#f2dfb4"), 1.03);
    sand.scale.set(7.2, .9, 3.3);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      toon("#ec7a4f", { emissive: "#8a2d10", emissiveIntensity: .35 }));
    sun.position.set(4.2, 0, -2.6);
    sun.scale.set(1, 1, .45);
    g.add(sand, sun);
    for (let k = 0; k < 3; k++) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(.28, 1.3, .2), toon("#f1cb6d", { emissive: "#7a5a00", emissiveIntensity: .4 }));
      const a = .35 + k * .38;
      ray.position.set(4.2 + Math.cos(a) * 4.3, Math.sin(a) * 4.3, -2.6);
      ray.rotation.z = a - Math.PI / 2;
      g.add(ray);
      twinkles.push(ray);
    }
    ([[-2.8, -.5, 8, -.55, .4], [2.6, -.3, 5.8, .65, 1.9], [.1, .9, 3.8, .3, 3.3]] as const).forEach(([x, z, h, lean, phase]) => {
      const palm = makePalm(kit, h, lean, phase);
      palm.group.position.set(x, .55, z);
      g.add(palm.group);
      palms.push(palm);
    });
    const sparkleGeo = starGeometry();
    ([[-6.2, 7.8, .45], [6.8, 5.6, .35]] as const).forEach(([x, y, size]) => {
      const sparkle = new THREE.Mesh(sparkleGeo, toon("#f2b51c", { emissive: "#6b4a00", emissiveIntensity: .5 }));
      sparkle.position.set(x, y, -1);
      sparkle.scale.setScalar(size);
      g.add(sparkle);
      twinkles.push(sparkle);
    });
    const shade = blob(7);
    shade.position.set(0, .04, .4);
    g.add(shade);
    return g;
  }

  // ---------- Scenery: trees, flowers, clouds ----------
  const rand = seeded(20270423);
  const europe = setup.stops.find((s) => s.key === "europe");
  const plaza = europe ? { x: toWorld(europe).x - 9.5, z: toWorld(europe).z - 2.5 } : null;
  const la = setup.stops.find((s) => s.key === "hollywood");
  const laPos = la ? toWorld(la) : null;
  const keepClear = [setup.start, setup.item, setup.bonus, setup.goal, ...setup.hearts, ...setup.powers.map((p) => p.pos), ...setup.hazards.map((h) => h.pos)];
  const avoid = [...dots, ...keepClear, ...setup.stops.map((s) => toWorld(s)), ...setup.stops.map((s) => { const p = toWorld(s); return { x: p.x, z: p.z - 4 }; }),
    ...(plaza ? [plaza] : [])];
  const greens = ["#7fa86a", "#6e9a5e", "#9ab872", "#86a36b"];
  const trunkMat = toon("#8a5a3c");
  const canopies: THREE.Object3D[] = [];
  let scenicPalms = 0;
  for (let tries = 0, placed = 0; tries < 900 && placed < 70; tries++) {
    const x = rand() * (W + 4) - 2, z = rand() * (D + 4) - 2;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < ("seg" in a ? 4.2 : 9.5))) continue;
    placed++;
    // Around Los Angeles the scenery turns into swaying palms.
    if (laPos && scenicPalms < 4 && Math.hypot(laPos.x - x, laPos.z - z) < 22) {
      const palm = makePalm(kit, 3.4 + rand() * 1.4, (rand() - .5) * 1.2, rand() * 6);
      palm.group.position.set(x, 0, z);
      const shade = blob(1.6);
      shade.position.set(x, .04, z);
      scene.add(palm.group, shade);
      palms.push(palm);
      scenicPalms++;
      continue;
    }
    const tree = new THREE.Group();
    const scale = .75 + rand() * .55;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22, .32, 1.4, 6), trunkMat);
    trunk.position.y = .7;
    trunk.castShadow = true;
    const round = rand() < .45;
    const canopy = outlined(round ? new THREE.IcosahedronGeometry(1.5, 0) : new THREE.ConeGeometry(1.5, 3.4, 7), toon(greens[placed % greens.length]), 1.09);
    canopy.position.y = round ? 2.5 : 3;
    canopy.userData.phase = rand() * 6;
    canopies.push(canopy);
    tree.add(trunk, canopy);
    tree.scale.setScalar(scale);
    tree.position.set(x, 0, z);
    tree.rotation.y = rand() * Math.PI;
    scene.add(tree);
  }
  const petals = ["#f2a7b8", "#fff4c2", "#f6c27a", "#ffffff"];
  const flowerGeo = new THREE.SphereGeometry(.22, 6, 4);
  for (let i = 0; i < 90; i++) {
    const x = rand() * W, z = rand() * D;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < 2.5)) continue;
    const flower = new THREE.Mesh(flowerGeo, toon(petals[i % petals.length]));
    flower.position.set(x, .18, z);
    scene.add(flower);
  }
  const clouds: THREE.Group[] = [];
  const cloudMat = toon("#ffffff", { transparent: true, opacity: .92 });
  for (let i = 0; i < 6; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + rand() * 1.4, 10, 8), cloudMat);
      puff.position.set(j * 2 - 3, rand() * .8, rand() * 1.5);
      puff.castShadow = true;
      cloud.add(puff);
    }
    // High above the camera: guests only see their soft shadows drifting over the map.
    cloud.position.set(rand() * W, 100 + rand() * 8, rand() * D - 6);
    cloud.scale.setScalar(2.2);
    clouds.push(cloud);
    scene.add(cloud);
  }

  // ---------- Collectibles ----------
  const heartGeo = heartGeometry();
  const heartMat = toon("#e0405e", { emissive: "#5a0f20", emissiveIntensity: .25 });
  const hearts = setup.hearts.map((pos) => {
    const g = new THREE.Group();
    const h = outlined(heartGeo, heartMat, 1.12);
    h.position.y = 1.4;
    const s = blob(.8);
    g.add(h, s);
    g.position.set(pos.x, 0, pos.z);
    scene.add(g);
    return g;
  });
  const bonus = new THREE.Group();
  const star = outlined(starGeometry(), toon("#f2b51c", { emissive: "#6b4a00", emissiveIntensity: .35 }), 1.12);
  star.position.y = 1.9;
  bonus.add(star, blob(1));
  bonus.position.set(setup.bonus.x, 0, setup.bonus.z);
  scene.add(bonus);
  const powers = setup.powers.map((power) => {
    const g = new THREE.Group();
    const icon = emojiSprite(power.kind === "speed" ? "🐟" : power.kind === "shield" ? "🌿" : "💐", 2.1);
    icon.position.y = .75;
    const tint = power.kind === "speed" ? "#7cc0f0" : power.kind === "shield" ? "#8fd19a" : "#f2a7b8";
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.55, 20, 14),
      new THREE.MeshToonMaterial({ color: tint, gradientMap: ramp, transparent: true, opacity: .32, depthWrite: false }));
    bubble.position.y = 1.8;
    g.add(icon, bubble, blob(1.3));
    g.position.set(power.pos.x, 0, power.pos.z);
    scene.add(g);
    return g;
  });
  const item = new THREE.Group();
  const itemIcon = emojiSprite(setup.itemIcon, 3);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.7, .16, 8, 40), toon("#f1cb6d", { emissive: "#7a5a00", emissiveIntensity: .4 }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = .12;
  item.add(itemIcon, halo, blob(1.3));
  item.position.set(setup.item.x, 0, setup.item.z);
  scene.add(item);

  // ---------- Goal flag ----------
  const flag = new THREE.Group();
  const pole = outlined(new THREE.CylinderGeometry(.13, .13, 6, 8), toon("#5b4a3b"), 1.25);
  pole.position.y = 3;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8, 8, 1), toon("#8f3a57", { side: THREE.DoubleSide }));
  cloth.castShadow = true;
  const clothPivot = new THREE.Group();
  cloth.position.x = 1.4;
  clothPivot.add(cloth);
  clothPivot.position.y = 5.1;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, .14, 8, 48), toon("#8f3a57"));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .1;
  flag.add(pole, clothPivot, ring);
  flag.position.set(setup.goal.x + .6, 0, setup.goal.z + .4);
  scene.add(flag);
  const clothBase = (cloth.geometry.attributes.position.array as Float32Array).slice();

  // ---------- Hazards ----------
  function hpTexture() {
    const c = document.createElement("canvas");
    c.width = 96; c.height = 16;
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  function drawHp(texture: THREE.CanvasTexture, hp: number, max: number) {
    const c = texture.image as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#384c62";
    ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 8); ctx.fill();
    ctx.fillStyle = "#f1ece0";
    ctx.beginPath(); ctx.roundRect(3, 3, c.width - 6, c.height - 6, 5); ctx.fill();
    ctx.fillStyle = hp / max > .5 ? "#5aa55f" : hp / max > .25 ? "#f2b51c" : "#e0405e";
    if (hp > 0) { ctx.beginPath(); ctx.roundRect(3, 3, (c.width - 6) * hp / max, c.height - 6, 5); ctx.fill(); }
    texture.needsUpdate = true;
  }
  const heights: Record<HazardKind, number> = { yarn: 3, crab: 3.8, pigeon: 3.4, robot: 1.9, seal: 3.8, boss: 3.4 };
  const hazards = setup.hazards.map((hazard) => {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    let pigeon: Pigeon | undefined, vacuum: Vacuum | undefined, ball: THREE.Group | undefined, icon: THREE.Sprite | undefined;
    if (hazard.kind === "pigeon") { pigeon = makePigeon(kit, 1.15); body.add(pigeon.group); }
    else if (hazard.kind === "robot" || hazard.kind === "boss") { vacuum = makeVacuum(kit, hazard.kind === "boss" ? 1.75 : 1, hazard.kind === "boss"); body.add(vacuum.group); }
    else if (hazard.kind === "yarn") { const y = makeYarn(kit); ball = y.ball; body.add(y.group); }
    else { icon = emojiSprite(hazard.icon, 3.6); body.add(icon); }
    const shadow = blob(hazard.kind === "boss" ? 3.4 : 1.6);
    const dizzy = emojiSprite("💫", 1.6);
    const top = heights[hazard.kind];
    dizzy.position.y = top + .2;
    let bar: THREE.Sprite | undefined, barTex: THREE.CanvasTexture | undefined;
    if (hazard.maxHp > 1) {
      barTex = hpTexture();
      drawHp(barTex, hazard.maxHp, hazard.maxHp);
      bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, transparent: true, depthTest: false }));
      bar.renderOrder = 10;
      bar.center.set(.5, 0);
      bar.scale.set(hazard.kind === "boss" ? 4.8 : 2.6, hazard.kind === "boss" ? .8 : .45, 1);
      bar.position.y = top + (hazard.kind === "boss" ? 1.4 : .5);
      g.add(bar);
    }
    g.add(shadow, dizzy);
    g.position.set(hazard.pos.x, 0, hazard.pos.z);
    scene.add(g);
    return {
      kind: hazard.kind, maxHp: hazard.maxHp, group: g, body, pigeon, vacuum, ball, icon, dizzy, bar, barTex,
      shadow, lastHp: hazard.maxHp, prev: { ...hazard.pos }, heading: 0, speed: 0, face: 1, deadT: -1,
    };
  });

  // A little cobblestone plaza near Europe where real city pigeons peck around and scatter when the cat comes by.
  type Flock = { pigeon: Pigeon; home: Vec; pos: THREE.Vector3; heading: number; mode: "ground" | "fly" | "back"; t: number; away: Vec; wander: number };
  const flock: Flock[] = [];
  if (plaza) {
    const stones = document.createElement("canvas");
    stones.width = stones.height = 256;
    const sctx = stones.getContext("2d")!;
    sctx.fillStyle = "#e6dccb";
    sctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 22) for (let x = (y / 22) % 2 ? -14 : 0; x < 256; x += 28) {
      sctx.fillStyle = ["#d4c7b2", "#cdbfa8", "#dcd0bd"][(x + y) % 3];
      sctx.beginPath(); sctx.roundRect(x + 2, y + 2, 24, 18, 6); sctx.fill();
    }
    const stoneTex = new THREE.CanvasTexture(stones);
    stoneTex.colorSpace = THREE.SRGBColorSpace;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 40), new THREE.MeshLambertMaterial({ map: stoneTex }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(plaza.x, .03, plaza.z);
    disc.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.RingGeometry(5.6, 6, 48), new THREE.MeshBasicMaterial({ color: "#b9a88a" }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(plaza.x, .035, plaza.z);
    scene.add(disc, rim);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + .4;
      const r = 1.6 + (k % 3) * 1.2;
      const home = { x: plaza.x + Math.cos(a) * r, z: plaza.z + Math.sin(a) * r * .8 };
      const pigeon = makePigeon(kit, .6 + (k % 2) * .08);
      pigeon.group.position.set(home.x, 0, home.z);
      scene.add(pigeon.group);
      flock.push({ pigeon, home, pos: new THREE.Vector3(home.x, 0, home.z), heading: a * 3, mode: "ground", t: 0, away: { x: 0, z: 1 }, wander: k * 1.3 });
    }
  }

  // ---------- Weapons: claw swipe arcs and thrown bouquets ----------
  const swipe = new THREE.Group();
  const swipeMat = new THREE.MeshBasicMaterial({ color: "#fff4f7", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  [[2.3, 2.6], [3.1, 3.45], [3.9, 4.2]].forEach(([inner, outer]) => {
    const claw = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 24, 1, -1.05, 2.1), swipeMat);
    claw.rotation.x = -Math.PI / 2;
    swipe.add(claw);
  });
  const swipeEdge = new THREE.Mesh(new THREE.RingGeometry(1.9, 4.5, 24, 1, -1.05, 2.1),
    new THREE.MeshBasicMaterial({ color: "#e0405e", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  swipeEdge.rotation.x = -Math.PI / 2;
  swipeEdge.position.y = -.05;
  swipe.add(swipeEdge);
  swipe.visible = false;
  scene.add(swipe);
  let swipeT = 1;
  const shots = Array.from({ length: 10 }, () => {
    const s = emojiSprite("💐", 2);
    s.center.set(.5, .5);
    s.visible = false;
    scene.add(s);
    return s;
  });

  // ---------- The cat ----------
  const cat = new THREE.Group();
  const catSprite = standee(setup.catImg, 4.2);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.8, 24, 16),
    new THREE.MeshToonMaterial({ color: "#8fd19a", gradientMap: ramp, transparent: true, opacity: .3, depthWrite: false }));
  shield.position.y = 2.4;
  const carry = emojiSprite(setup.itemIcon, 2.2);
  carry.position.y = 4.8;
  const speedRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, .12, 6, 30), toon("#f1cb6d"));
  speedRing.rotation.x = -Math.PI / 2;
  speedRing.position.y = .12;
  cat.add(catSprite, blob(2.4), shield, carry, speedRing);
  cat.position.set(setup.start.x, 0, setup.start.z);
  scene.add(cat);
  let turn = 1;

  // ---------- Camera rig ----------
  const eye = new THREE.Vector3(), look = new THREE.Vector3();
  function cameraGoal(mode: Frame["camera"], cat: Vec, toward: Vec) {
    const aspect = camera.aspect;
    const zoom = aspect < .75 ? 1.55 : aspect < 1.15 ? 1.25 : 1;
    if (mode === "overview") {
      const mid = { x: (setup.start.x + setup.goal.x) / 2, z: (setup.start.z + setup.goal.z) / 2 };
      return { eye: new THREE.Vector3(mid.x, 46 * zoom, mid.z + 40 * zoom), look: new THREE.Vector3(mid.x, 0, mid.z - 4) };
    }
    // Lean toward where the guest needs to go, but keep the camera over the board.
    const lean = Math.min(1, 12 / (Math.hypot(toward.x - cat.x, toward.z - cat.z) || 1)) * .35;
    const pos = { x: cat.x + (toward.x - cat.x) * lean, z: cat.z + (toward.z - cat.z) * lean };
    const margin = aspect >= 1 ? 24 : 10;
    const x = Math.min(W - margin, Math.max(margin, pos.x));
    const z = Math.min(D - 12, Math.max(20, pos.z));
    return { eye: new THREE.Vector3(x, 34 * zoom, z + 31 * zoom), look: new THREE.Vector3(x, 1, z) };
  }
  let snapped = false;
  let time = 0;

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  function frame(f: Frame) {
    time += f.dt;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Cat
    cat.position.set(f.cat.pos.x, f.cat.walking && !reduce ? Math.abs(Math.sin(time * 13)) * .45 : 0, f.cat.pos.z);
    // Turn around like a paper cut-out: squash to a sliver, flip, and open back up.
    turn = reduce ? f.cat.face : turn + (f.cat.face - turn) * (1 - Math.exp(-f.dt * 16));
    catSprite.scale.x = (catSprite.userData.w as number) * Math.max(.12, Math.abs(turn));
    setFlip(catSprite, turn);
    catSprite.material.rotation = f.cat.walking && !reduce ? Math.sin(time * 13) * .05 : 0;
    catSprite.visible = !f.cat.hurt || Math.floor(time * 14) % 2 === 0;
    shield.visible = f.cat.shield;
    shield.scale.setScalar(1 + Math.sin(time * 6) * .04);
    carry.visible = f.cat.carrying;
    carry.position.y = 4.8 + Math.sin(time * 5) * .25;
    speedRing.visible = f.cat.fast;
    speedRing.rotation.z = time * 8;
    // Collectibles spin and bob
    hearts.forEach((h, i) => { h.children[0].rotation.y = time * 2.2 + i; h.children[0].position.y = 1.4 + Math.sin(time * 3 + i) * .25; });
    star.rotation.y = time * 3;
    star.position.y = 1.9 + Math.sin(time * 2.4) * .3;
    powers.forEach((p, i) => { p.children[1].position.y = 1.8 + Math.sin(time * 2.5 + i) * .2; });
    item.visible = f.itemVisible;
    itemIcon.position.y = .6 + Math.sin(time * 2.4) * .35;
    halo.scale.setScalar(1 + Math.sin(time * 4) * .08);
    // Flag waves
    clothPivot.rotation.y = Math.sin(time * 2) * .25;
    const pos = cloth.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = clothBase[i * 3];
      pos.setZ(i, Math.sin(time * 6 + x * 2.2) * .18 * (x + 1.4));
    }
    pos.needsUpdate = true;
    ring.scale.setScalar(1 + Math.sin(time * 3) * .08);
    // Hazards
    f.hazards.forEach((p, i) => {
      const hz = hazards[i];
      if (!hz) return;
      if (p.alive && hz.deadT >= 0) {
        // Retry: bring defeated critters back.
        hz.deadT = -1;
        hz.group.visible = true;
        hz.body.position.set(0, 0, 0);
        hz.body.scale.setScalar(1);
        hz.body.rotation.set(0, 0, 0);
        hz.shadow.visible = true;
        hz.prev = { x: p.x, z: p.z };
      }
      if (!p.alive) {
        if (hz.deadT < 0) hz.deadT = 0;
        hz.deadT += f.dt;
        const d = hz.deadT;
        hz.dizzy.visible = false;
        if (hz.bar) hz.bar.visible = false;
        if (hz.pigeon) {
          // Defeated pigeons just give up and fly off.
          hz.body.position.y = d * d * 9 + d * 4;
          hz.body.position.z = d * 8;
          hz.shadow.scale.setScalar(Math.max(.01, 1.6 - d));
          hz.pigeon.animate(time, 0, 1);
          hz.group.visible = d < 2.2;
        } else {
          hz.body.rotation.y += f.dt * 18;
          hz.body.position.y = Math.sin(Math.min(d, .6) / .6 * Math.PI) * 2;
          hz.body.scale.setScalar(Math.max(.01, 1 - d / .6));
          hz.shadow.visible = d < .6;
          hz.group.visible = d < .7;
        }
        return;
      }
      const vx = (p.x - hz.prev.x) / Math.max(f.dt, 1e-3), vz = (p.z - hz.prev.z) / Math.max(f.dt, 1e-3);
      hz.prev = { x: p.x, z: p.z };
      const speed = Math.hypot(vx, vz);
      hz.speed += (speed - hz.speed) * Math.min(1, f.dt * 10);
      if (speed > .6) {
        hz.heading += angleTo(hz.heading, Math.atan2(vx, vz)) * Math.min(1, f.dt * (hz.vacuum ? 6 : 10));
        if (Math.abs(vx) > .4) hz.face = vx < 0 ? -1 : 1;
      }
      hz.group.position.set(p.x, 0, p.z);
      hz.body.visible = !p.hurt || Math.floor(time * 18) % 2 === 0;
      hz.dizzy.visible = p.stunned;
      hz.dizzy.position.x = Math.cos(time * 6) * .5;
      hz.dizzy.material.rotation = time * 4;
      if (hz.bar && hz.barTex) {
        if (hz.lastHp !== p.hp) { drawHp(hz.barTex, p.hp, hz.maxHp); hz.lastHp = p.hp; }
        hz.bar.visible = hz.kind === "boss" || p.hp < hz.maxHp;
      }
      const moving = hz.speed > .8 ? 1 : 0;
      if (hz.pigeon) {
        hz.body.rotation.y = hz.heading;
        hz.pigeon.animate(reduce ? 0 : time + i, p.stunned ? 0 : moving, 0);
      } else if (hz.vacuum) {
        hz.body.rotation.y = hz.heading + (p.stunned ? time * 5 : 0);
        hz.vacuum.animate(time, f.dt, moving, p.angry && !p.stunned);
      } else if (hz.ball) {
        hz.body.rotation.y = hz.heading;
        hz.ball.rotation.x += hz.speed * f.dt / 1.2;
        hz.body.position.y = reduce ? 0 : Math.abs(Math.sin(time * 6 + i)) * .15;
      } else if (hz.icon) {
        setFlip(hz.icon, hz.face);
        hz.icon.material.rotation = reduce ? 0 : Math.sin(time * 10 + i) * .16;
        hz.icon.position.y = reduce ? 0 : Math.abs(Math.sin(time * 8 + i)) * .35;
      }
    });

    // Plaza pigeons scatter when the cat gets close, then drift back down.
    let scattered = false;
    flock.forEach((b, k) => {
      b.t += f.dt;
      const toCat = Math.hypot(f.cat.pos.x - b.pos.x, f.cat.pos.z - b.pos.z);
      if (b.mode === "ground") {
        if (toCat < 6.5) {
          b.mode = "fly"; b.t = 0; scattered = true;
          const len = toCat || 1;
          b.away = { x: (b.pos.x - f.cat.pos.x) / len, z: (b.pos.z - f.cat.pos.z) / len };
          b.heading = Math.atan2(b.away.x, b.away.z);
        } else {
          // Shuffle around the plaza, pecking.
          b.wander += f.dt * .45;
          const tx = b.home.x + Math.cos(b.wander + k) * .9, tz = b.home.z + Math.sin(b.wander * 1.3 + k) * .7;
          const dx = tx - b.pos.x, dz = tz - b.pos.z;
          b.pos.x += dx * f.dt * 1.5; b.pos.z += dz * f.dt * 1.5;
          const walking = Math.hypot(dx, dz) > .25;
          if (walking) b.heading += angleTo(b.heading, Math.atan2(dx, dz)) * Math.min(1, f.dt * 6);
          b.pigeon.animate(reduce ? 0 : time + k * .7, walking ? 1 : 0, 0);
        }
      } else if (b.mode === "fly") {
        b.pos.x += b.away.x * f.dt * 9;
        b.pos.z += b.away.z * f.dt * 9;
        b.pos.y = Math.min(14, b.pos.y + f.dt * (7 - b.t * 1.5));
        b.pigeon.animate(time, 0, 1);
        if (b.t > 2.6) { b.mode = "back"; b.t = 0; }
      } else {
        const dx = b.home.x - b.pos.x, dz = b.home.z - b.pos.z;
        const len = Math.hypot(dx, dz);
        if (len > .3) { b.pos.x += dx / len * f.dt * 7; b.pos.z += dz / len * f.dt * 7; b.heading += angleTo(b.heading, Math.atan2(dx, dz)) * Math.min(1, f.dt * 8); }
        b.pos.y = Math.max(0, Math.min(b.pos.y, len * .9));
        b.pigeon.animate(time, 0, b.pos.y > .05 ? 1 : 0);
        if (len <= .3 && b.pos.y <= .01 && toCat > 9) { b.mode = "ground"; b.t = 0; }
      }
      b.pigeon.group.position.copy(b.pos);
      b.pigeon.group.rotation.y = b.heading;
    });

    // Weapons
    if (swipeT < 1) {
      swipeT += f.dt / .24;
      swipe.position.set(f.cat.pos.x, 1.3, f.cat.pos.z);
      swipe.scale.setScalar(.75 + swipeT * .4);
      swipeMat.opacity = Math.max(0, 1 - swipeT) * .95;
      (swipeEdge.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - swipeT) * .35;
      swipe.visible = swipeT < 1;
    }
    shots.forEach((sprite, k) => {
      const shot = f.shots[k];
      sprite.visible = Boolean(shot);
      if (!shot) return;
      sprite.position.set(shot.x, 1.7, shot.z);
      sprite.material.rotation = shot.spin;
    });
    palms.forEach((palm) => palm.animate(reduce ? 0 : time));
    if (!reduce) {
      canopies.forEach((c) => { c.rotation.z = Math.sin(time * 1.3 + (c.userData.phase as number)) * .05; c.rotation.x = Math.sin(time * 1.1 + (c.userData.phase as number) * 2) * .03; });
      twinkles.forEach((t, k) => { t.scale.setScalar((k < 3 ? 1 : .4) * (1 + Math.sin(time * 3 + k * 1.3) * .18)); });
    }
    clouds.forEach((c, i) => { c.position.x += f.dt * (.6 + i * .1); if (c.position.x > W + 30) c.position.x = -30; });
    // Camera
    const goal = cameraGoal(f.camera, f.cat.pos, f.itemVisible ? setup.item : setup.goal);
    if (!snapped || reduce) { eye.copy(goal.eye); look.copy(goal.look); snapped = true; }
    else {
      const k = 1 - Math.exp(-f.dt * (f.camera === "overview" ? 2 : 3.2));
      eye.lerp(goal.eye, k);
      look.lerp(goal.look, k);
    }
    camera.position.copy(eye);
    camera.lookAt(look);
    renderer.render(scene, camera);
    return { scattered };
  }

  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pick(clientX: number, clientY: number): Vec | null {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    return hit ? { x: hit.x, z: hit.z } : null;
  }
  function project(p: Vec, y = 0) {
    const v = new THREE.Vector3(p.x, y, p.z).project(camera);
    return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight, visible: v.z < 1 };
  }

  function reset() {
    hearts.forEach((h) => { h.visible = true; });
    powers.forEach((p) => { p.visible = true; });
    bonus.visible = true;
  }

  function dispose() {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      materials.forEach((m) => {
        (m as THREE.MeshBasicMaterial).map?.dispose();
        m.dispose();
      });
    });
    ramp.dispose();
    renderer.dispose();
  }

  return {
    frame, pick, project, resize, reset, dispose,
    /** Show the claw-swipe arc in front of the cat, facing `dir`. */
    swipe: (dir: Vec) => { swipe.rotation.y = Math.atan2(-dir.z, dir.x); swipeT = 0; swipe.visible = true; },
    hideHeart: (i: number) => { hearts[i].visible = false; },
    hidePower: (i: number) => { powers[i].visible = false; },
    hideBonus: () => { bonus.visible = false; },
  };
}

export type World = ReturnType<typeof createWorld>;
