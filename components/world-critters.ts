// Hand-built low-poly models for the 3D map: plaza pigeons, a robot vacuum, a rolling yarn ball and
// swaying Los Angeles palm trees. Everything is built facing +z so callers can turn it with rotation.y.
import * as THREE from "three";

export type Kit = {
  toon: (color: THREE.ColorRepresentation, extra?: THREE.MeshToonMaterialParameters) => THREE.MeshToonMaterial;
  outlined: (geo: THREE.BufferGeometry, material: THREE.Material, thickness?: number) => THREE.Group;
  blob: (radius: number) => THREE.Mesh;
};

const OUTLINE = 0x384c62;

function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number) {
  obj.position.set(x, y, z);
  return obj;
}

// ---------------------------------------------------------------------------------------------
// Plaza pigeon: blue-grey body, iridescent green/purple neck, orange eyes, black wing bars, pink feet.
export type Pigeon = {
  group: THREE.Group;
  /** Walk cycle (0 = idle). Heads bob forward with each step, like a real pigeon. */
  animate: (time: number, walking: number, flying: number) => void;
};

export function makePigeon(kit: Kit, scale = 1): Pigeon {
  const { toon, outlined } = kit;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const sphere = new THREE.SphereGeometry(1, 14, 10);
  const plumage = toon("#9aa3b6");
  const torso = outlined(sphere, plumage, 1.07);
  torso.scale.set(.82, .78, 1.22);
  at(torso, 0, 1.15, 0);
  const breast = new THREE.Mesh(sphere, toon("#b3a9bd"));
  breast.scale.set(.66, .66, .62);
  at(breast, 0, 1.18, .62);
  body.add(torso, breast);

  // Wings with the two black bars every city pigeon has.
  const wingMat = toon("#8790a4");
  const barMat = toon("#2f3443");
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    at(pivot, side * .62, 1.42, .1);
    const wing = new THREE.Mesh(sphere, wingMat);
    wing.scale.set(.2, .5, 1.05);
    at(wing, side * .14, -.18, -.25);
    wing.castShadow = true;
    for (const z of [-.25, -.62]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.05, .11, .5), barMat);
      at(bar, side * .32, -.18, z);
      bar.rotation.x = .15;
      pivot.add(bar);
    }
    pivot.add(wing);
    body.add(pivot);
    wings.push(pivot);
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(.72, .1, 1), toon("#6c7387"));
  at(tail, 0, 1.0, -1.35);
  tail.rotation.x = -.28;
  const tailBand = new THREE.Mesh(new THREE.BoxGeometry(.74, .12, .22), barMat);
  at(tailBand, 0, .88, -1.78);
  tailBand.rotation.x = -.28;
  body.add(tail, tailBand);

  // Neck and head live on a pivot so the head can thrust forward and peck.
  const head = new THREE.Group();
  at(head, 0, 1.55, .72);
  const neck = new THREE.Mesh(sphere, toon("#5f9d86", { emissive: "#3c2a5e", emissiveIntensity: .25 }));
  neck.scale.set(.5, .56, .5);
  at(neck, 0, .15, .05);
  const sheen = new THREE.Mesh(new THREE.TorusGeometry(.42, .09, 6, 18), toon("#8c6bb0"));
  sheen.rotation.x = Math.PI / 2 - .4;
  at(sheen, 0, .05, .04);
  const skull = outlined(new THREE.SphereGeometry(.42, 14, 10), toon("#7c859a"), 1.08);
  at(skull, 0, .62, .28);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.085, .38, 8), toon("#363636"));
  beak.rotation.x = Math.PI / 2;
  at(beak, 0, .56, .82);
  const cere = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), toon("#ece7dd"));
  at(cere, 0, .62, .64);
  head.add(neck, sheen, skull, beak, cere);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), toon("#ee7a2c"));
    at(eye, side * .3, .7, .46);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    at(pupil, side * .38, .71, .5);
    head.add(eye, pupil);
  }
  body.add(head);

  // Pink legs and feet.
  const legs: THREE.Group[] = [];
  const legMat = toon("#dd7480");
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    at(leg, side * .26, .62, .15);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .62, 6), legMat);
    at(shin, 0, -.31, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.3, .06, .4), legMat);
    at(foot, 0, -.6, .12);
    leg.add(shin, foot);
    group.add(leg);
    legs.push(leg);
  }

  group.scale.setScalar(scale);
  let peck = 0;
  return {
    group,
    animate(time, walking, flying) {
      const step = time * 11;
      // Head thrust: forward fast, back slowly, once per step.
      const thrust = walking ? ((step / Math.PI) % 1 < .35 ? .22 : -.08) : 0;
      if (!walking && !flying) peck = Math.max(0, Math.sin(time * 1.7 + scale * 9));
      else peck = 0;
      head.position.z += ((.72 + thrust) - head.position.z) * .35;
      head.rotation.x = peck > .82 ? (peck - .82) * 5 : 0;
      body.rotation.z = walking ? Math.sin(step) * .09 : 0;
      legs.forEach((leg, i) => {
        leg.rotation.x = flying ? .9 : walking ? Math.sin(step + i * Math.PI) * .55 : 0;
        leg.visible = true;
      });
      wings.forEach((wing, i) => {
        const side = i ? 1 : -1;
        wing.rotation.z = flying ? side * (.3 + Math.sin(time * 26) * .95) : 0;
      });
      body.rotation.x = flying ? -.35 : 0;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Robot vacuum: white shell, glossy black lid, lidar turret, bumper, status LED and spinning side brushes.
export type Vacuum = {
  group: THREE.Group;
  animate: (time: number, dt: number, moving: number, angry: boolean) => void;
};

export function makeVacuum(kit: Kit, scale = 1, crowned = false): Vacuum {
  const { toon, outlined } = kit;
  const group = new THREE.Group();
  const R = 1.8;
  const shell = outlined(new THREE.CylinderGeometry(R, R * .97, .46, 40), toon("#eef0f1"), 1.05);
  at(shell, 0, .33, 0);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(R * .84, R * .84, .06, 40),
    new THREE.MeshStandardMaterial({ color: "#23262c", roughness: .25, metalness: .35 }));
  at(lid, 0, .58, 0);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(R * .84, .025, 6, 48), new THREE.MeshBasicMaterial({ color: "#8a9099" }));
  seam.rotation.x = Math.PI / 2;
  at(seam, 0, .6, 0);
  // Front bumper wraps the front half of the shell.
  const bumper = new THREE.Mesh(new THREE.CylinderGeometry(R + .05, R + .05, .32, 40, 1, true, -Math.PI / 2, Math.PI),
    toon("#4f545c", { side: THREE.DoubleSide }));
  at(bumper, 0, .3, 0);
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(.9, .1, .06), new THREE.MeshStandardMaterial({ color: "#111", roughness: .1, metalness: .6 }));
  at(sensor, 0, .36, R + .07);
  // Lidar turret near the back of the lid, spinning.
  const turret = new THREE.Group();
  at(turret, 0, .6, -.55);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(.45, .48, .26, 24), new THREE.MeshStandardMaterial({ color: "#30343b", roughness: .4, metalness: .3 }));
  at(dome, 0, .13, 0);
  const window_ = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, .05), new THREE.MeshBasicMaterial({ color: "#7fd0ff" }));
  at(window_, 0, .14, .46);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .05, 24), toon("#9aa1aa"));
  at(cap, 0, .28, 0);
  turret.add(dome, window_, cap);
  // Power button with a status ring.
  const button = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .04, 24), toon("#c3c8cf"));
  at(button, 0, .63, .55);
  const ledMat = new THREE.MeshBasicMaterial({ color: "#36d07a" });
  const led = new THREE.Mesh(new THREE.TorusGeometry(.26, .035, 6, 30), ledMat);
  led.rotation.x = Math.PI / 2;
  at(led, 0, .64, .55);
  group.add(shell, lid, seam, bumper, sensor, turret, button, led);

  // Two three-armed side brushes poking out at the front corners.
  const brushes: THREE.Group[] = [];
  const bristle = new THREE.MeshBasicMaterial({ color: "#3a3a3a" });
  for (const side of [-1, 1]) {
    const brush = new THREE.Group();
    at(brush, side * 1.15, .08, 1.2);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .06, 10), toon("#5a5f66"));
    brush.add(hub);
    for (let k = 0; k < 3; k++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .03, .95), bristle);
      arm.position.set(Math.sin(k * 2.09) * .45, 0, Math.cos(k * 2.09) * .45);
      arm.rotation.y = k * 2.09;
      brush.add(arm);
    }
    group.add(brush);
    brushes.push(brush);
  }

  let crown: THREE.Group | undefined;
  if (crowned) {
    crown = new THREE.Group();
    const gold = toon("#f9c95c", { emissive: "#6b4a00", emissiveIntensity: .3 });
    const band = outlined(new THREE.CylinderGeometry(.62, .62, .32, 20, 1, true), gold, 1.06);
    at(band, 0, .16, 0);
    crown.add(band);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(.16, .45, 6), gold);
      at(spike, Math.sin(a) * .58, .52, Math.cos(a) * .58);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), toon(k % 2 ? "#9b3358" : "#ff6a3d"));
      at(gem, Math.sin(a) * .63, .2, Math.cos(a) * .63);
      crown.add(spike, gem);
    }
    at(crown, 0, .9, -.55);
    group.add(crown);
  }

  group.scale.setScalar(scale);
  return {
    group,
    animate(time, dt, moving, angry) {
      brushes.forEach((b, i) => { b.rotation.y += dt * (moving ? 22 : 6) * (i ? -1 : 1); });
      turret.rotation.y += dt * (angry ? 9 : 3);
      ledMat.color.set(angry ? (Math.floor(time * 6) % 2 ? "#ff3b3b" : "#7a1010") : "#36d07a");
      group.rotation.z = moving ? Math.sin(time * 30) * .012 : 0;
      if (crown) crown.position.y = .9 + Math.abs(Math.sin(time * 4)) * .12;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Yarn ball: wrapped strands plus a loose tail; rolls as it moves.
export type Yarn = { group: THREE.Group; ball: THREE.Group };

export function makeYarn(kit: Kit): Yarn {
  const { toon, outlined } = kit;
  const group = new THREE.Group();
  const ball = new THREE.Group();
  at(ball, 0, 1.25, 0);
  ball.add(outlined(new THREE.SphereGeometry(1.2, 18, 14), toon("#d98aa6"), 1.07));
  const strand = toon("#9b3358");
  for (let k = 0; k < 5; k++) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(1.21, .055, 6, 40), strand);
    wrap.rotation.set(k * .7, k * 1.3, k * .45);
    ball.add(wrap);
  }
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.9, -.7, .4), new THREE.Vector3(1.6, -1.15, .8), new THREE.Vector3(2.4, -1.2, .4), new THREE.Vector3(3, -1.2, 1),
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .06, 5), strand);
  group.add(ball, tail);
  return { group, ball };
}

// ---------------------------------------------------------------------------------------------
// Palm tree in the style of the Los Angeles sticker: cream ringed trunk, olive fronds, orange coconuts.
export type Palm = { group: THREE.Group; animate: (time: number) => void };

function frondGeometry(length: number, width: number) {
  const geo = new THREE.PlaneGeometry(length, width, 10, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + length / 2; // 0 at the crown, `length` at the tip
    const y = pos.getY(i);
    const u = x / length;
    const taper = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - u * .35);
    // Serrated edge: little notches like the sticker's leaflets.
    const notch = Math.abs(y) > width * .3 ? (Math.floor(u * 9) % 2 ? .82 : 1) : 1;
    pos.setXYZ(i, x, -u * u * length * .55, y * taper * notch);
  }
  geo.computeVertexNormals();
  return geo;
}

export function makePalm(kit: Kit, height: number, lean: number, phase: number): Palm {
  const { toon, outlined } = kit;
  const group = new THREE.Group();
  const trunk = new THREE.Group();
  group.add(trunk);
  const segments = Math.max(5, Math.round(height / 1.1));
  const segH = height / segments;
  const trunkMat = toon("#f1deb1");
  let top = new THREE.Vector3();
  for (let i = 0; i < segments; i++) {
    const u = i / segments;
    const r = .5 - u * .2;
    const seg = outlined(new THREE.CylinderGeometry(r * .92, r, segH * .96, 9), trunkMat, 1.1);
    const x = lean * u * u * height * .35;
    seg.position.set(x, segH * (i + .5), 0);
    seg.rotation.z = -lean * u * .5;
    trunk.add(seg);
    top = new THREE.Vector3(lean * ((i + 1) / segments) ** 2 * height * .35, segH * (i + 1), 0);
  }

  const crown = new THREE.Group();
  crown.position.copy(top);
  trunk.add(crown);
  const leaf = toon("#8c9c68", { side: THREE.DoubleSide });
  const edge = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.DoubleSide });
  const fronds: THREE.Group[] = [];
  const count = 7;
  const length = 2.2 + height * .2;
  const geo = frondGeometry(length, 1.05);
  for (let k = 0; k < count; k++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (k / count) * Math.PI * 2 + phase;
    const tilt = new THREE.Group();
    tilt.rotation.z = .35 + (k % 2) * .12;
    const blade = new THREE.Mesh(geo, leaf);
    blade.castShadow = true;
    const rim = new THREE.Mesh(geo, edge);
    rim.scale.set(1.02, 1, 1.07);
    rim.position.y = -.05;
    tilt.add(rim, blade);
    pivot.add(tilt);
    crown.add(pivot);
    fronds.push(tilt);
  }
  const nut = toon("#ff6a3d");
  for (let k = 0; k < 3; k++) {
    const coconut = outlined(new THREE.SphereGeometry(.3, 10, 8), nut, 1.12);
    coconut.position.set(Math.sin(k * 2.1) * .32, -.3, Math.cos(k * 2.1) * .32);
    crown.add(coconut);
  }

  return {
    group,
    animate(time) {
      const gust = Math.sin(time * .9 + phase) * .5 + Math.sin(time * 2.3 + phase * 2) * .25;
      trunk.rotation.z = gust * .035;
      trunk.rotation.x = Math.sin(time * .7 + phase) * .02;
      crown.rotation.y = Math.sin(time * .5 + phase) * .12;
      fronds.forEach((f, k) => {
        f.rotation.z = .35 + (k % 2) * .12 + Math.sin(time * 3.1 + k * 1.7 + phase) * .09 + gust * .06;
      });
    },
  };
}
