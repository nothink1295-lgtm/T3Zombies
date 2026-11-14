import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from './config.js';
import { W, H, LEVELS } from './level.js';

const CELL = CONFIG.cellSize;
const WALL_H = CONFIG.wallHeight;
const cellCenter = (c) => (c + 0.5) * CELL;
let levelIndex = 0;
let level = LEVELS[levelIndex];
let GRID = level.grid;
let EX = {
  x0: level.exit[0] * CELL, x1: (level.exit[0] + 1) * CELL,
  z0: level.exit[1] * CELL, z1: (level.exit[1] + 1) * CELL,
};

// ------------------------------------------------------------
// Escena, cámara, render
// ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a0e);
scene.fog = new THREE.Fog(0x070a0e, 12, 75);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';
scene.add(camera); // necesario para que las armas (hijas de la cámara) se rendericen

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Iluminación
scene.add(new THREE.AmbientLight(0xc2ceda, 1.8));
const muzzleLight = new THREE.PointLight(0xffaa55, 0, 8);
muzzleLight.position.set(0.2, -0.1, -0.8);
camera.add(muzzleLight);

// ------------------------------------------------------------
// Mundo: suelo, techo y muros (InstancedMesh)
// ------------------------------------------------------------
function makeTexture(draw, repeatX, repeatY) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const wallTex = makeTexture((g) => {
  g.fillStyle = '#697781'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#35434c'; g.lineWidth = 3;
  for (let y = 0; y < 128; y += 32) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    for (let x = 0; x < 128; x += 64) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke();
      g.fillStyle = '#a7b3ba'; g.fillRect(x + 5, y + 5, 3, 3);
      g.fillRect(x + 56, y + 5, 3, 3);
    }
  }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
}, 1, 1);

const floorTex = makeTexture((g) => {
  g.fillStyle = '#34383a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`; g.fillRect(Math.random() * 128, Math.random() * 128, 4, 4); }
  g.strokeStyle = '#222'; g.strokeRect(0, 0, 128, 128);
}, W, H);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(W * CELL, H * CELL),
  new THREE.MeshLambertMaterial({ map: floorTex })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set((W * CELL) / 2, 0, (H * CELL) / 2);
scene.add(floor);

const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(W * CELL, H * CELL),
  new THREE.MeshLambertMaterial({ color: 0x15181c })
);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.set((W * CELL) / 2, WALL_H, (H * CELL) / 2);
scene.add(ceiling);

const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTex, metalness: 0.58, roughness: 0.4 });
const bloodTex = makeTexture((g) => {
  for (let i = 0; i < 8; i++) {
    const x = 20 + Math.random() * 88, y = 20 + Math.random() * 88;
    g.fillStyle = `rgba(75, 0, 5, ${0.35 + Math.random() * 0.35})`;
    g.beginPath();
    g.ellipse(x, y, 10 + Math.random() * 18, 6 + Math.random() * 13, Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
    for (let d = 0; d < 5; d++) {
      g.beginPath();
      g.arc(x + Math.random() * 50 - 25, y + Math.random() * 50 - 25, 1 + Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
}, 1, 1);
const worldGroup = new THREE.Group();
scene.add(worldGroup);
const LIGHT_FACES = [
  { dx: 0, dz: -1, rotation: Math.PI },
  { dx: 0, dz: 1, rotation: 0 },
  { dx: 1, dz: 0, rotation: Math.PI / 2 },
  { dx: -1, dz: 0, rotation: -Math.PI / 2 },
];

function zonePad(parent, x0, z0, x1, z1, color) {
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0, z1 - z0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  parent.add(pad);
  return pad;
}

function addWallLight(parent, c, r, face, color) {
  const x = cellCenter(c) + face.dx * (CELL / 2 - 0.04);
  const z = cellCenter(r) + face.dz * (CELL / 2 - 0.04);
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.34, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x353c44, metalness: 0.7, roughness: 0.3 })
  );
  const lens = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.18, 0.04),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4 })
  );
  fixture.add(lens);
  fixture.position.set(x, WALL_H * 0.7, z);
  fixture.rotation.y = face.rotation;
  lens.position.z = 0.08;
  parent.add(fixture);
  const intensity = color === 0xff3038 ? 32 : 44;
  const light = new THREE.PointLight(color, intensity, 18, 2);
  light.position.set(x + face.dx * 0.22, WALL_H * 0.7, z + face.dz * 0.22);
  parent.add(light);
}

function poolGeometry(width, depth) {
  const shape = new THREE.Shape();
  const points = 16;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const irregularity = 0.78 + Math.random() * 0.22;
    const x = Math.cos(angle) * width * 0.5 * irregularity;
    const y = Math.sin(angle) * depth * 0.5 * irregularity;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function buildLevelWorld() {
  worldGroup.clear();
  let wallCount = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (GRID[r][c] === '#') wallCount++;
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), wallMaterial, wallCount);
  const matrix = new THREE.Matrix4();
  let instance = 0;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (GRID[r][c] !== '#') continue;
      matrix.setPosition(cellCenter(c), WALL_H / 2, cellCenter(r));
      walls.setMatrixAt(instance++, matrix);
    }
  }
  walls.instanceMatrix.needsUpdate = true;
  worldGroup.add(walls);

  let lightIndex = 0;
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (GRID[r][c] !== '#' || (c * 7 + r * 13 + level.number * 3) % 17 !== 0) continue;
      const faces = LIGHT_FACES.filter((face) => GRID[r + face.dz][c + face.dx] === '.');
      if (!faces.length) continue;
      const face = faces[(c + r) % faces.length];
      addWallLight(worldGroup, c, r, face, lightIndex++ % 2 ? 0xf3f7ff : 0xff3038);
    }
  }

  const startX = level.start[0] * CELL, startZ = level.start[1] * CELL;
  zonePad(worldGroup, startX, startZ, startX + CELL, startZ + CELL, 0x2e86ff);
  EX = {
    x0: level.exit[0] * CELL, x1: (level.exit[0] + 1) * CELL,
    z0: level.exit[1] * CELL, z1: (level.exit[1] + 1) * CELL,
  };
  const exitColor = levelIndex === LEVELS.length - 1 ? 0x2eff6a : 0xffbf32;
  zonePad(worldGroup, EX.x0, EX.z0, EX.x1, EX.z1, exitColor);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, WALL_H, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: exitColor, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  beacon.position.set((EX.x0 + EX.x1) / 2, WALL_H / 2, (EX.z0 + EX.z1) / 2);
  worldGroup.add(beacon);
  const exitLight = new THREE.PointLight(exitColor, 60, 22, 1.5);
  exitLight.position.set(beacon.position.x, 3, beacon.position.z);
  worldGroup.add(exitLight);

  const bloodMaterial = new THREE.MeshBasicMaterial({
    map: bloodTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
  for (const [c, r] of level.bloodCells) {
    const stain = new THREE.Mesh(poolGeometry(3.2, 2.7), bloodMaterial);
    stain.rotation.set(-Math.PI / 2, Math.random() * Math.PI, 0);
    stain.position.set(cellCenter(c), 0.003, cellCenter(r));
    worldGroup.add(stain);
  }
}

buildLevelWorld();

// ------------------------------------------------------------
// Colisiones sobre la cuadrícula
// ------------------------------------------------------------
function isWallAt(x, z) {
  const c = Math.floor(x / CELL), r = Math.floor(z / CELL);
  if (c < 0 || r < 0 || c >= W || r >= H) return true;
  return GRID[r][c] === '#';
}
function blocked(x, z, rad) {
  const c0 = Math.floor((x - rad) / CELL), c1 = Math.floor((x + rad) / CELL);
  const r0 = Math.floor((z - rad) / CELL), r1 = Math.floor((z + rad) / CELL);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isWallAt((c + 0.5) * CELL, (r + 0.5) * CELL)) continue;
      const closestX = Math.max(c * CELL, Math.min(x, (c + 1) * CELL));
      const closestZ = Math.max(r * CELL, Math.min(z, (r + 1) * CELL));
      if ((x - closestX) ** 2 + (z - closestZ) ** 2 < rad ** 2) return true;
    }
  }
  return false;
}
function moveWithCollision(pos, dx, dz, rad) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / Math.max(rad * 0.5, 0.1)));
  const stepX = dx / steps, stepZ = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (!blocked(pos.x + stepX, pos.z, rad)) pos.x += stepX;
    if (!blocked(pos.x, pos.z + stepZ, rad)) pos.z += stepZ;
  }
}
const PATH_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function buildEnemyDistanceField() {
  const distances = new Int16Array(W * H);
  distances.fill(-1);
  const startC = Math.floor(player.x / CELL), startR = Math.floor(player.z / CELL);
  if (startC < 0 || startR < 0 || startC >= W || startR >= H || GRID[startR][startC] === '#') return null;

  const queue = new Int16Array(W * H);
  const start = startR * W + startC;
  let head = 0, tail = 0;
  distances[start] = 0;
  queue[tail++] = start;

  while (head < tail) {
    const current = queue[head++];
    const c = current % W, r = Math.floor(current / W);
    for (const [dc, dr] of PATH_DIRECTIONS) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= W || nr >= H || GRID[nr][nc] === '#') continue;
      const next = nr * W + nc;
      if (distances[next] !== -1) continue;
      distances[next] = distances[current] + 1;
      queue[tail++] = next;
    }
  }
  return distances;
}
function enemyWaypoint(x, z, distances) {
  if (!distances) return { x: player.x, z: player.z };
  const c = Math.floor(x / CELL), r = Math.floor(z / CELL);
  if (c < 0 || r < 0 || c >= W || r >= H) return { x: player.x, z: player.z };
  const current = r * W + c;
  if (distances[current] <= 0) return { x: player.x, z: player.z };

  let bestC = c, bestR = r, bestDistance = distances[current];
  for (const [dc, dr] of PATH_DIRECTIONS) {
    const nc = c + dc, nr = r + dr;
    if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
    const distance = distances[nr * W + nc];
    if (distance >= 0 && distance < bestDistance) {
      bestC = nc;
      bestR = nr;
      bestDistance = distance;
    }
  }
  return { x: cellCenter(bestC), z: cellCenter(bestR) };
}
// ¿Hay línea de visión libre entre dos puntos? (para ataques)
function lineClear(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const steps = Math.ceil(Math.hypot(dx, dz) / 0.5);
  for (let i = 1; i < steps; i++) if (isWallAt(ax + (dx * i) / steps, az + (dz * i) / steps)) return false;
  return true;
}
// Distancia a la primera pared a lo largo de un rayo (evita disparar a través de muros)
function wallDistance(origin, dir, max) {
  for (let t = 0; t < max; t += 0.1) if (isWallAt(origin.x + dir.x * t, origin.z + dir.z * t)) return t;
  return max;
}

// ------------------------------------------------------------
// Carga de modelos GLB (con marcador si el archivo no existe)
// ------------------------------------------------------------
const loader = new GLTFLoader();
const modelStatus = { weapons: CONFIG.weapons.map(() => false), enemies: {} };

function setShadowless(obj) { obj.traverse((o) => { o.frustumCulled = false; }); }

function fitByLongest(obj, size) {
  const wrap = new THREE.Group();
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  obj.scale.setScalar(size / Math.max(dim.x, dim.y, dim.z));
  obj.updateMatrixWorld(true);
  const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
  obj.position.sub(c);
  wrap.add(obj);
  return wrap;
}
function fitByHeight(obj, height) {
  const wrap = new THREE.Group();
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  obj.scale.setScalar(height / (box.max.y - box.min.y || 1));
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -b.min.y, -c.z); // pies en y = 0
  wrap.add(obj);
  return wrap;
}

const weaponHolders = [];
const SWORD_SWING_DURATION = 0.32;
let swordSwingT = 0;
function makeSword() {
  const sword = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: 0xb51b32,
    emissive: 0xff001e,
    emissiveIntensity: 1.8,
    metalness: 0.82,
    roughness: 0.2,
  });
  const aura = new THREE.MeshBasicMaterial({
    color: 0xff1235,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const grip = new THREE.MeshStandardMaterial({ color: 0x33231a, roughness: 0.8 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xa97736, metalness: 0.7, roughness: 0.35 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.72), steel);
  blade.position.z = -0.39;
  const bladeAura = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.76), aura);
  bladeAura.position.z = blade.position.z;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 4), steel);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.84;
  const tipAura = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 4), aura);
  tipAura.rotation.x = tip.rotation.x;
  tipAura.position.z = tip.position.z;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.09), bronze);
  guard.position.z = -0.04;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.28, 8), grip);
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.16;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bronze);
  pommel.position.z = 0.33;
  const glow = new THREE.PointLight(0xff001e, 0.8, 1.2);
  glow.position.set(0, 0.03, -0.4);
  sword.add(bladeAura, tipAura, blade, tip, guard, handle, pommel, glow);
  return sword;
}
function fallbackWeapon(i) {
  const g = new THREE.Group();
  const col = new THREE.Color(CONFIG.weapons[i].color);
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const len = i === 0 ? 0.3 : 0.7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, len), mat);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.07), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  grip.position.set(0, -0.12, len / 2 - 0.05);
  g.add(body, grip);
  return g;
}

async function loadWeapons() {
  for (let i = 0; i < CONFIG.weapons.length; i++) {
    const w = CONFIG.weapons[i];
    let obj;
    if (w.melee) {
      obj = makeSword();
      modelStatus.weapons[i] = true;
    } else {
      try {
        const gltf = await loader.loadAsync(w.file);
        obj = fitByLongest(gltf.scene, w.size);
        modelStatus.weapons[i] = true;
      } catch (e) {
        console.warn(`No se pudo cargar ${w.file}; se usa un marcador.`, e);
        obj = fallbackWeapon(i);
      }
    }
    setShadowless(obj);
    const holder = new THREE.Group();
    const modelFrame = new THREE.Group();
    modelFrame.rotation.set(...(w.modelRotation || [0, 0, 0]));
    modelFrame.add(obj);
    holder.add(modelFrame);
    holder.position.set(...w.position);
    holder.rotation.set(...w.rotation);
    holder.userData.basePos = holder.position.clone();
    holder.userData.baseRotX = holder.rotation.x;
    holder.userData.baseRotY = holder.rotation.y;
    holder.userData.baseRotZ = holder.rotation.z;
    holder.userData.sword = Boolean(w.melee);
    holder.visible = false;
    camera.add(holder);
    weaponHolders.push(holder);
  }
}

const enemyTemplates = {};
const enemyClips = {};
let zombieVariantBag = [];
async function loadCharacterModels() {
  const jobs = [];
  for (const [type, settings] of Object.entries(CONFIG.enemy)) {
    if (typeof settings !== 'object') continue;
    if (type === 'zombie' && settings.files) {
      jobs.push(Promise.all(settings.files.map((file) => loader.loadAsync(file).then((gltf) => {
        const model = fitByHeight(gltf.scene, CONFIG.enemy.height);
        setShadowless(model);
        return { model, clips: gltf.animations || [] };
      }).catch((error) => {
        console.warn(`No se pudo cargar ${file}.`, error);
        return null;
      }))).then((variants) => {
        enemyTemplates[type] = variants.filter(Boolean);
        modelStatus.enemies[type] = enemyTemplates[type].length > 0;
      }));
      continue;
    }
    if (!settings.file) continue;
    jobs.push(loader.loadAsync(settings.file).then((gltf) => {
      enemyTemplates[type] = fitByHeight(gltf.scene, settings.height || CONFIG.enemy.height);
      setShadowless(enemyTemplates[type]);
      enemyClips[type] = gltf.animations || [];
      modelStatus.enemies[type] = true;
    }).catch((error) => console.warn(`No se pudo cargar ${settings.file}.`, error)));
  }
  await Promise.all(jobs);
}

function fallbackZombie(type = 'zombie') {
  const g = new THREE.Group();
  const colors = {
    zombie: [0x5f8a4a, 0x3a3f52], demon1: [0xa33bbb, 0x382344],
    demon2: [0xb85a32, 0x48251b], demon3: [0xc84327, 0x55231d],
    necro: [0x83aacc, 0x283a56],
  }[type] || [0x5f8a4a, 0x3a3f52];
  const skin = new THREE.MeshLambertMaterial({ color: colors[0] });
  const cloth = new THREE.MeshLambertMaterial({ color: colors[1] });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), cloth); torso.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skin); head.position.y = 1.65;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), cloth); legL.position.set(-0.15, 0.35, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.6), skin); armL.position.set(-0.4, 1.3, 0.3);
  const armR = armL.clone(); armR.position.x = 0.4;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), eyeMat); eyeL.position.set(-0.08, 1.68, 0.17);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.08;
  g.add(torso, head, legL, legR, armL, armR, eyeL, eyeR);
  return g;
}

// ------------------------------------------------------------
// Estado del juego
// ------------------------------------------------------------
let state = 'loading'; // loading | ready | playing | paused | won | lost
const player = new THREE.Vector3();
let yaw = 0, pitch = 0;
let current = 0;
let ammo = [];
let health = CONFIG.player.maxHealth;
let defending = false;
let nextShot = 0;
let recoil = 0, muzzleFlash = 0, bobT = 0;
let zombies = [];
let pickups = [];
let hazards = [];
let projectiles = [];
let summonedZombies = 0;
const keys = {};
const clock = new THREE.Clock();

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const slotEls = CONFIG.weapons.map((w, i) => {
  const el = document.createElement('div');
  el.className = 'slot';
  el.style.setProperty('--c', w.color);
  el.innerHTML = `<span class="key">${i + 1}</span><span class="wname">${w.name}</span><span class="ammo">0</span>`;
  $('weapons').appendChild(el);
  return el;
});
let msgTimer = 0;
function showMsg(text, ms = 1600) {
  $('msg').textContent = text;
  $('msg').classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => $('msg').classList.remove('show'), ms);
}
function updateHUD() {
  slotEls.forEach((el, i) => {
    el.classList.toggle('active', i === current);
    const a = el.querySelector('.ammo');
    const melee = CONFIG.weapons[i].melee;
    a.textContent = melee ? '∞' : ammo[i];
    a.classList.toggle('empty', !melee && ammo[i] <= 0);
  });
  $('zcount').textContent = zombies.filter((z) => z.state !== 'dead').length;
  $('health').textContent = Math.ceil(health);
  $('healthbar').style.width = `${(health / CONFIG.player.maxHealth) * 100}%`;
  const dx = (EX.x0 + EX.x1) / 2 - player.x, dz = (EX.z0 + EX.z1) / 2 - player.z;
  $('dist').textContent = Math.round(Math.hypot(dx, dz));
  $('level').textContent = level.number;
}
function showScreen(title, text, btn, cls = '') {
  $('title').textContent = title;
  $('subtitle').textContent = text;
  $('btn').textContent = btn;
  $('btn').disabled = false;
  $('overlay').className = cls;
}
function hideScreen() { $('overlay').classList.add('hidden'); }

// ------------------------------------------------------------
// Audio sintetizado (sin archivos externos)
// ------------------------------------------------------------
let actx = null;
function beep(f0, f1, dur, type = 'square', vol = 0.12) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, actx.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), actx.currentTime + dur);
  g.gain.setValueAtTime(vol, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g).connect(actx.destination);
  o.start(); o.stop(actx.currentTime + dur);
}

// ------------------------------------------------------------
// Entidades: zombis y objetos recogibles
// ------------------------------------------------------------
function clearEntities() {
  zombies.forEach((z) => scene.remove(z.group));
  pickups.forEach((p) => scene.remove(p.mesh));
  hazards.forEach((h) => scene.remove(h.group));
  projectiles.forEach((p) => scene.remove(p.mesh));
  zombies = []; pickups = []; hazards = []; projectiles = [];
}

function spawnEnemy(type, x, z, fast = false, raising = false) {
  const settings = CONFIG.enemy[type] || CONFIG.enemy.zombie;
  const enemyHeight = settings.height || CONFIG.enemy.height;
  const group = new THREE.Group();
  group.position.set(x, raising ? -1.6 : 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;

  const body = new THREE.Group();
  const templates = enemyTemplates[type];
  let template = templates;
  let clips = enemyClips[type] || [];
  if (Array.isArray(templates)) {
    if (type === 'zombie') {
      if (!zombieVariantBag.length) {
        zombieVariantBag = templates.map((_, index) => index);
        for (let i = zombieVariantBag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [zombieVariantBag[i], zombieVariantBag[j]] = [zombieVariantBag[j], zombieVariantBag[i]];
        }
      }
      const variant = templates[zombieVariantBag.pop()];
      template = variant && variant.model;
      clips = variant ? variant.clips : [];
    } else {
      template = templates[Math.floor(Math.random() * templates.length)];
    }
  }
  const model = template ? SkeletonUtils.clone(template) : fallbackZombie(type);
  if (!template && enemyHeight !== CONFIG.enemy.height) model.scale.setScalar(enemyHeight / CONFIG.enemy.height);
  body.add(model);
  group.add(body);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, enemyHeight, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = enemyHeight / 2;
  group.add(hit);

  const healthBar = new THREE.Group();
  healthBar.position.y = enemyHeight + 0.35;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), new THREE.MeshBasicMaterial({ color: 0x210d0d, side: THREE.DoubleSide }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3d3d, side: THREE.DoubleSide }));
  fill.position.set(-0.03, 0, 0.01);
  healthBar.add(back, fill);
  healthBar.visible = false;
  group.add(healthBar);

  let mixer = null;
  if (template && clips.length) {
    mixer = new THREE.AnimationMixer(body);
    const clip = clips.find((item) => /walk|run|shamble/i.test(item.name)) || clips[0];
    mixer.clipAction(clip).play();
    mixer.timeScale = 0;
  }

  const hp = settings.hp;
  const enemy = {
    type, group, body, hit, healthBar, fill, mixer, hp, maxHp: hp,
    state: 'idle',
    speed: (fast && settings.fastSpeed ? settings.fastSpeed : settings.speed) * (0.9 + Math.random() * 0.2),
    attackRange: settings.attackRange,
    damage: settings.damage,
    attackCooldown: settings.attackCooldown,
    attackT: 1 + Math.random(),
    stagger: 0,
    deathT: 0,
    raising,
    raiseT: 0,
    summoned: false,
  };
  hit.userData.zombie = enemy;
  scene.add(group);
  zombies.push(enemy);
  return enemy;
}

function addPickup(type, c, r, weapon) {
  const mesh = new THREE.Group();
  let baseY = 0.7;
  if (type === 'ammo') {
    const color = new THREE.Color(CONFIG.weapons[weapon].color);
    mesh.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.32, 0.36),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, metalness: 0.45, roughness: 0.35 })
    ));
  } else if (type === 'health') {
    baseY = 0.8;
    const bottle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 1), new THREE.MeshStandardMaterial({ color: 0xe64b58, emissive: 0x8e111d, emissiveIntensity: 0.5 }));
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.08), crossV.material);
    crossV.position.z = 0.25;
    crossH.position.z = 0.25;
    mesh.add(bottle, crossV, crossH);
  }
  mesh.position.set(cellCenter(c), baseY, cellCenter(r));
  scene.add(mesh);
  pickups.push({ mesh, type, weapon, baseY, taken: false });
}

function addHazard(type, c, r) {
  const group = new THREE.Group();
  group.position.set(cellCenter(c), 0, cellCenter(r));

  if (type === 'lava') {
    const crust = new THREE.Mesh(
      poolGeometry(2.6, 2.3),
      new THREE.MeshBasicMaterial({ color: 0x5b1006, side: THREE.DoubleSide })
    );
    crust.rotation.x = -Math.PI / 2;
    crust.position.y = 0.012;
    const hot = new THREE.Mesh(
      poolGeometry(2.0, 1.8),
      new THREE.MeshBasicMaterial({ color: 0xff3900, side: THREE.DoubleSide })
    );
    hot.rotation.x = -Math.PI / 2;
    hot.position.y = 0.018;
    const core = new THREE.Mesh(
      poolGeometry(1.15, 1.05),
      new THREE.MeshBasicMaterial({ color: 0xffb21c, side: THREE.DoubleSide })
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.024;
    const light = new THREE.PointLight(0xff4100, 5, 5, 2);
    light.position.y = 0.35;
    group.add(crust, hot, core, light);
    scene.add(group);
    hazards.push({ type, group, radius: 1.2, light });
    return;
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.08, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x343b42, metalness: 0.75, roughness: 0.38 })
  );
  base.position.y = 0.04;
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.035, 0.78),
    new THREE.MeshStandardMaterial({ color: 0x8c3325, emissive: 0x551107, emissiveIntensity: 0.5, metalness: 0.45, roughness: 0.4 })
  );
  plate.position.y = 0.097;
  const spikeMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c2c8, metalness: 0.85, roughness: 0.28 });
  const spikes = [];
  for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), spikeMaterial);
    spike.position.set(x, 0.21, z);
    spikes.push(spike);
  }
  group.add(base, plate, ...spikes);
  scene.add(group);
  hazards.push({ type, group, radius: 0.95, damage: 30, cooldown: 2.5, nextTrigger: 0 });
}

function spawnEntities() {
  for (const [c, r, fast, type = 'zombie'] of level.zombieSpawns)
    spawnEnemy(type, cellCenter(c), cellCenter(r), Boolean(fast));
  for (const [c, r, wi] of level.ammoSpawns) {
    addPickup('ammo', c, r, wi);
  }
  for (const [c, r] of level.medkitSpawns) addPickup('health', c, r);
  for (const [c, r] of level.lavaCells) addHazard('lava', c, r);
  for (const [c, r] of level.trapCells) addHazard('trap', c, r);
}

// ------------------------------------------------------------
// Armas y disparo
// ------------------------------------------------------------
function selectWeapon(i) {
  if (i < 0 || i >= weaponHolders.length) return;
  current = i;
  if (!CONFIG.weapons[i].melee) defending = false;
  weaponHolders.forEach((h, k) => (h.visible = k === i));
  recoil = 0;
}

const raycaster = new THREE.Raycaster();
function shoot() {
  const now = performance.now() / 1000;
  const w = CONFIG.weapons[current];
  if (now < nextShot) return;

  if (w.melee) {
    nextShot = now + w.cooldown;
    swordSwingT = SWORD_SWING_DURATION;
    beep(260, 100, 0.12, 'sawtooth', 0.12);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = w.range;
    const { origin, direction } = raycaster.ray;
    const wallDist = wallDistance(origin, direction, w.range);
    const targets = zombies.filter((z) => z.state !== 'dead').map((z) => z.hit);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length && hits[0].distance < wallDist) {
      const enemy = hits[0].object.userData.zombie;
      hitZombie(enemy, w.knockback, enemy.type === 'zombie' ? 1.5 : w.damage);
    }
    return;
  }

  // RF02: sin munición no se dispara
  if (ammo[current] <= 0) {
    beep(300, 200, 0.05, 'square', 0.05);
    showMsg('¡SIN MUNICIÓN!', 900);
    nextShot = now + 0.25;
    return;
  }
  ammo[current]--;
  nextShot = now + w.cooldown;
  recoil = 1; muzzleFlash = 1;
  beep(180, 40, 0.14, 'sawtooth', 0.15);

  // La escopeta lanza varios perdigones, pero consume munición una vez por clic.
  camera.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  let selectedEnemy = null;
  let selectedDistance = Infinity;
  const damagedEnemies = new Set();
  for (let i = 0; i < (w.pellets || 1); i++) {
    const centered = i < (w.centerPellets || 1);
    const aim = !w.spread || centered
      ? new THREE.Vector2(0, 0)
      : new THREE.Vector2((Math.random() * 2 - 1) * w.spread, (Math.random() * 2 - 1) * w.spread);
    raycaster.setFromCamera(aim, camera);
    raycaster.far = w.range;
    const { origin, direction } = raycaster.ray;
    const wallDist = wallDistance(origin, direction, w.range);
    const targets = zombies.filter((z) => z.state !== 'dead').map((z) => z.hit);
    const hits = raycaster.intersectObjects(targets, false);
    if (w.pellets) {
      if (hits.length && hits[0].distance < wallDist) {
        const enemy = hits[0].object.userData.zombie;
        if (!damagedEnemies.has(enemy)) {
          damagedEnemies.add(enemy);
          hitZombie(enemy, 0, w.damage || 1);
        }
      }
    } else if (hits.length && hits[0].distance < wallDist && hits[0].distance < selectedDistance) {
      selectedEnemy = hits[0].object.userData.zombie;
      selectedDistance = hits[0].distance;
    }
  }
  if (!w.pellets && selectedEnemy) hitZombie(selectedEnemy, 0, w.damage || 1);
}

function updateEnemyHealthbar(enemy) {
  const ratio = Math.max(0, enemy.hp / enemy.maxHp);
  enemy.fill.scale.x = ratio;
  enemy.fill.position.x = -0.42 + 0.42 * ratio;
}

function hitZombie(z, knockback = 0, damage = 1) {
  if (z.state === 'dead') return;
  if (knockback > 0) {
    const dx = z.group.position.x - player.x, dz = z.group.position.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0) moveWithCollision(z.group.position, (dx / distance) * knockback, (dz / distance) * knockback, CONFIG.enemy.radius);
  }
  z.hp -= damage;
  z.healthBar.visible = true;
  updateEnemyHealthbar(z);
  const h = $('hitmarker');
  h.classList.add('show');
  setTimeout(() => h.classList.remove('show'), 90);
  beep(110, 60, 0.1, 'square', 0.1);

  if (z.hp <= 0) {
    z.state = 'dead';
    z.group.remove(z.hit);
    if (z.mixer) z.mixer.timeScale = 0;
    z.healthBar.visible = false;
    showMsg(z.type === 'zombie' ? 'ZOMBI ELIMINADO' : 'DEMONIO ELIMINADO', 900);
  } else {
    z.stagger = 0.3;
  }
}

function damagePlayer(amount, deathMessage = 'Te han derrotado los infectados.') {
  health = Math.max(0, health - amount);
  $('damage').classList.add('show');
  setTimeout(() => $('damage').classList.remove('show'), 180);
  updateHUD();
  if (health <= 0) gameOver(deathMessage);
}

function isAttackBlocked(sourceX, sourceZ) {
  if (!defending || !CONFIG.weapons[current].melee) return false;
  const dx = sourceX - player.x, dz = sourceZ - player.z;
  const distance = Math.hypot(dx, dz);
  if (distance === 0) return true;
  const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw);
  return ((dx * forwardX) + (dz * forwardZ)) / distance >= 0.35;
}

function fireProjectile(enemy, damage, color, speed, offset = 0) {
  const origin = enemy.group.position.clone();
  origin.y += enemy.type === 'necro' ? 1.55 : (CONFIG.enemy[enemy.type].height || CONFIG.enemy.height) * 0.75;
  const right = new THREE.Vector3(Math.cos(enemy.group.rotation.y), 0, -Math.sin(enemy.group.rotation.y));
  origin.addScaledVector(right, offset);
  const target = new THREE.Vector3(player.x, CONFIG.player.eyeHeight * 0.8, player.z);
  const direction = target.sub(origin).normalize();
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(enemy.type === 'demon2' ? 0.18 : 0.14, 1), material);
  mesh.position.copy(origin);
  scene.add(mesh);
  projectiles.push({
    mesh,
    velocity: direction.multiplyScalar(speed),
    damage,
    life: 4,
    sourceX: enemy.group.position.x,
    sourceZ: enemy.group.position.z,
  });
}

function summonZombies(enemy) {
  if (enemy.type !== 'necro' || enemy.summoned || summonedZombies >= 3) return;
  enemy.summoned = true;
  const offsets = [[-1.2, 0], [1.2, 0], [0, 1.2]];
  let added = 0;
  for (const [dx, dz] of offsets) {
    const x = enemy.group.position.x + dx;
    const z = enemy.group.position.z + dz;
    if (isWallAt(x, z)) continue;
    const minion = spawnEnemy('zombie', x, z, false, true);
    minion.group.rotation.y = Math.random() * Math.PI * 2;
    added++;
  }
  summonedZombies += added;
  if (added) showMsg('EL NECRO LEVANTA ZOMBIS', 1400);
}

// ------------------------------------------------------------
// Actualización por frame
// ------------------------------------------------------------
function updatePlayer(dt) {
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const moving = f !== 0 || s !== 0;
  if (moving) {
    const sp = CONFIG.player.speed;
    const len = Math.hypot(f, s);
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const dx = ((-sin * f + cos * s) / len) * sp * dt;
    const dz = ((-cos * f - sin * s) / len) * sp * dt;
    moveWithCollision(player, dx, dz, CONFIG.player.radius);
    bobT += dt * 10;
  }
  camera.position.set(player.x, CONFIG.player.eyeHeight + (moving ? Math.sin(bobT) * 0.04 : 0), player.z);
  camera.rotation.set(pitch, yaw, 0);
  zombies.forEach((z) => {
    if (z.healthBar.visible) z.healthBar.quaternion.copy(camera.quaternion);
  });

  // Arma pegada a la cámara: balanceo + retroceso
  const h = weaponHolders[current];
  if (h) {
    const b = h.userData.basePos;
    swordSwingT = Math.max(0, swordSwingT - dt);
    const bobX = moving ? Math.cos(bobT * 0.5) * 0.01 : 0;
    const bobY = moving ? Math.abs(Math.sin(bobT)) * 0.015 : 0;
    if (h.userData.sword) {
      const swing = swordSwingT > 0 ? Math.sin((1 - swordSwingT / SWORD_SWING_DURATION) * Math.PI) : 0;
      const blocking = defending ? 1 : 0;
      const blend = 1 - Math.exp(-14 * dt);
      const targetX = b.x + bobX - blocking * 0.32;
      const targetY = b.y + bobY + blocking * 0.22;
      const targetZ = b.z + swing * 0.12 * (1 - blocking) - blocking * 0.04;
      h.position.x += (targetX - h.position.x) * blend;
      h.position.y += (targetY - h.position.y) * blend;
      h.position.z += (targetZ - h.position.z) * blend;
      const targetRotX = h.userData.baseRotX + (blocking ? -0.25 : swing * 0.55);
      const targetRotY = h.userData.baseRotY + (blocking ? Math.PI / 2 : swing * 0.8);
      const targetRotZ = h.userData.baseRotZ - blocking * 0.12;
      h.rotation.x += (targetRotX - h.rotation.x) * blend;
      h.rotation.y += (targetRotY - h.rotation.y) * blend;
      h.rotation.z += (targetRotZ - h.rotation.z) * blend;
    } else {
      h.position.set(b.x + bobX, b.y + bobY, b.z + recoil * 0.08);
      h.rotation.x = h.userData.baseRotX + recoil * 0.12;
    }
  }
  recoil = Math.max(0, recoil - dt * 8);
  muzzleFlash = Math.max(0, muzzleFlash - dt * 14);
  muzzleLight.intensity = muzzleFlash * 25;

  // RF08: zona de extracción
  if (player.x > EX.x0 && player.x < EX.x1 && player.z > EX.z0 && player.z < EX.z1) win();
}

function updateZombies(dt) {
  const distances = buildEnemyDistanceField();
  for (const z of zombies) {
    if (z.mixer) z.mixer.update(dt);
    const pos = z.group.position;

    if (z.state === 'dead') {
      z.deathT = Math.min(1, z.deathT + dt * 0.8);
      pos.y = -2 * z.deathT;
      if (z.deathT >= 1) z.group.visible = false;
      continue;
    }

    if (z.raising) {
      z.raiseT = Math.min(1, z.raiseT + dt * 0.8);
      pos.y = -1.6 * (1 - z.raiseT);
      if (z.raiseT >= 1) {
        z.raising = false;
        z.state = 'idle';
        if (z.mixer) z.mixer.timeScale = 0;
      }
      continue;
    }

    const dx = player.x - pos.x, dz = player.z - pos.z;
    const dist = Math.hypot(dx, dz);

    if (z.state === 'idle') {
      if (dist > CONFIG.enemy.detectionRange) continue;
      z.state = 'active';
      if (z.mixer) z.mixer.timeScale = 1;
    }

    if (z.type === 'zombie' && dist <= CONFIG.enemy.radius + CONFIG.player.radius) {
      gameOver('Un zombi te ha atrapado.');
      return;
    }

    const canAttack = dist <= z.attackRange && lineClear(pos.x, pos.z, player.x, player.z);
    if (z.stagger > 0) { z.stagger -= dt; continue; }

    z.attackT -= dt;
    if (canAttack) {
      z.group.rotation.y = Math.atan2(dx, dz) + CONFIG.enemy.yawOffset;
      if (z.attackT <= 0) {
        if (z.type === 'zombie') {
          if (isAttackBlocked(pos.x, pos.z)) showMsg('ATAQUE BLOQUEADO', 500);
          else damagePlayer(z.damage);
        } else {
          summonZombies(z);
          const settings = CONFIG.enemy[z.type];
          if (z.type === 'demon2') {
            fireProjectile(z, z.damage, settings.projectileColor, settings.projectileSpeed, -0.3);
            fireProjectile(z, z.damage, settings.projectileColor, settings.projectileSpeed, 0.3);
          } else {
            fireProjectile(z, z.damage, settings.projectileColor, settings.projectileSpeed);
          }
        }
        z.attackT = z.attackCooldown;
      }
      if (state !== 'playing') return;
      if (z.type === 'zombie' || dist <= z.attackRange * 0.8) continue;
    }
    const waypoint = enemyWaypoint(pos.x, pos.z, distances);
    const pathX = waypoint.x - pos.x, pathZ = waypoint.z - pos.z;
    const pathDistance = Math.hypot(pathX, pathZ);
    if (pathDistance > 0.01) {
      z.group.rotation.y = Math.atan2(pathX, pathZ) + CONFIG.enemy.yawOffset;
      const step = Math.min(z.speed * dt, pathDistance);
      moveWithCollision(pos, (pathX / pathDistance) * step, (pathZ / pathDistance) * step, CONFIG.enemy.radius);
    }
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    projectile.life -= dt;
    projectile.mesh.position.addScaledVector(projectile.velocity, dt);
    if (projectile.life <= 0 || isWallAt(projectile.mesh.position.x, projectile.mesh.position.z)) {
      scene.remove(projectile.mesh);
      projectiles.splice(i, 1);
      continue;
    }
    if (projectile.mesh.position.distanceTo(new THREE.Vector3(player.x, CONFIG.player.eyeHeight * 0.8, player.z)) < 0.6) {
      if (isAttackBlocked(projectile.sourceX, projectile.sourceZ)) showMsg('ATAQUE BLOQUEADO', 500);
      else damagePlayer(projectile.damage);
      scene.remove(projectile.mesh);
      projectiles.splice(i, 1);
      if (state !== 'playing') return;
    }
  }
}

function updateHazards(t) {
  for (const hazard of hazards) {
    const distance = Math.hypot(hazard.group.position.x - player.x, hazard.group.position.z - player.z);
    if (hazard.type === 'lava') {
      hazard.light.intensity = 4.5 + Math.sin(t * 5 + hazard.group.position.x) * 1.2;
      if (distance < hazard.radius) {
        gameOver('La lava te ha quemado.');
        return;
      }
    } else if (distance < hazard.radius && t >= hazard.nextTrigger) {
      hazard.nextTrigger = t + hazard.cooldown;
      showMsg(`¡TRAMPA! -${hazard.damage} VIDA`, 900);
      damagePlayer(hazard.damage, 'Una trampa te ha derrotado.');
      if (state !== 'playing') return;
    }
  }
}

function updatePickups(dt, t) {
  for (const p of pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt * 2;
    p.mesh.position.y = p.baseY + Math.sin(t * 3 + p.mesh.position.x) * 0.08;
    const d = Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z);
    if (d < 1.1) {
      if (p.type === 'health' && health >= CONFIG.player.maxHealth) continue;
      p.taken = true;
      p.mesh.visible = false;
      if (p.type === 'ammo') {
        const w = CONFIG.weapons[p.weapon];
        ammo[p.weapon] += w.pickupAmmo;
        showMsg(`+${w.pickupAmmo} ${w.ammoUnit} · ${w.name}`);
        beep(500, 900, 0.15, 'sine', 0.12);
      } else if (p.type === 'health') {
        health = Math.min(CONFIG.player.maxHealth, health + CONFIG.player.medkitHealth);
        showMsg(`+${CONFIG.player.medkitHealth} VIDA`);
        beep(500, 900, 0.15, 'sine', 0.12);
      }
      updateHUD();
    }
  }
}

// ------------------------------------------------------------
// Victoria / derrota / reinicio
// ------------------------------------------------------------
function endGame(newState) {
  state = newState;
  defending = false;
  document.exitPointerLock();
  for (const k in keys) keys[k] = false;
}

function enterLevel(index) {
  levelIndex = index;
  level = LEVELS[levelIndex];
  GRID = level.grid;
  buildLevelWorld();
  clearEntities();
  zombieVariantBag = [];
  summonedZombies = 0;
  player.set(cellCenter(level.start[0]), 0, cellCenter(level.start[1]));
  const [c, r] = level.start;
  if (GRID[r][c + 1] === '.') yaw = -Math.PI / 2;
  else if (GRID[r + 1][c] === '.') yaw = Math.PI;
  else if (GRID[r][c - 1] === '.') yaw = Math.PI / 2;
  else yaw = 0;
  pitch = 0;
  spawnEntities();
  updateHUD();
}

function win() {
  if (state !== 'playing') return;
  if (levelIndex < LEVELS.length - 1) {
    enterLevel(levelIndex + 1);
    showMsg(`ENTRADA AL NIVEL ${level.number}`, 2600);
    beep(500, 1000, 0.4, 'sine', 0.15);
    return;
  }
  endGame('won');
  showScreen('¡MISIÓN COMPLETADA!', 'Has escapado de los dos niveles.', 'JUGAR DE NUEVO', 'won');
  beep(500, 1000, 0.5, 'sine', 0.15);
}
function gameOver(message = 'Te han derrotado los infectados.') {
  if (state !== 'playing') return;
  endGame('lost');
  $('damage').classList.add('show');
  showScreen('GAME OVER', message, 'REINICIAR', 'lost');
  beep(200, 30, 0.8, 'sawtooth', 0.2);
}
function resetGame() {
  clearEntities();
  levelIndex = 0;
  level = LEVELS[levelIndex];
  GRID = level.grid;
  buildLevelWorld();
  zombieVariantBag = [];
  ammo = CONFIG.weapons.map((w) => w.startAmmo);
  health = CONFIG.player.maxHealth;
  defending = false;
  summonedZombies = 0;
  player.set(cellCenter(level.start[0]), 0, cellCenter(level.start[1]));
  const [c, r] = level.start;
  if (GRID[r][c + 1] === '.') yaw = -Math.PI / 2;
  else if (GRID[r + 1][c] === '.') yaw = Math.PI;
  else if (GRID[r][c - 1] === '.') yaw = Math.PI / 2;
  else yaw = 0;
  pitch = 0;
  recoil = 0; muzzleFlash = 0;
  $('damage').classList.remove('show');
  spawnEntities();
  selectWeapon(0);
  state = 'ready';
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
$('btn').addEventListener('click', () => {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (state === 'won' || state === 'lost') resetGame();
  const p = canvas.requestPointerLock();
  if (p && p.catch) p.catch(() => {});
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    hideScreen();
    if (state === 'ready' || state === 'paused') state = 'playing';
  } else if (state === 'playing') {
    defending = false;
    state = 'paused';
    showScreen('PAUSA', 'Haz clic para continuar', 'CONTINUAR');
  }
});

document.addEventListener('mousemove', (e) => {
  if (state !== 'playing' || document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * CONFIG.player.mouseSensitivity;
  pitch -= e.movementY * CONFIG.player.mouseSensitivity;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});

// RF01: 'mousedown' se dispara UNA vez por clic -> mantener pulsado no es automático
document.addEventListener('mousedown', (e) => {
  if (e.button === 2) {
    defending = state === 'playing' && document.pointerLockElement === canvas && Boolean(CONFIG.weapons[current].melee);
    return;
  }
  if (e.button !== 0 || state !== 'playing' || document.pointerLockElement !== canvas) return;
  shoot();
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) defending = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (state !== 'playing') return;
  if (e.code === 'Digit1') selectWeapon(0);
  if (e.code === 'Digit2') selectWeapon(1);
  if (e.code === 'Digit3') selectWeapon(2);
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ------------------------------------------------------------
// Bucle principal
// ------------------------------------------------------------
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (state === 'playing') {
    updatePlayer(dt);
    if (state === 'playing') updateHazards(t);
    if (state === 'playing') updateZombies(dt);
    if (state === 'playing') updateProjectiles(dt);
    if (state === 'playing') updatePickups(dt, t);
    if (state === 'playing') updateHUD();
  }
  renderer.render(scene, camera);
}

// ------------------------------------------------------------
// Inicio
// ------------------------------------------------------------
(async function init() {
  $('subtitle').textContent = 'Sobrevive, administra tus balas y llega a la zona de extracción.';
  await Promise.all([loadWeapons(), loadCharacterModels()]);

  const missing = Object.entries(CONFIG.enemy)
    .filter(([type, settings]) => (settings.file || settings.files) && !modelStatus.enemies[type])
    .map(([, settings]) => settings.files ? settings.files.join(', ') : settings.file);
  const missingWeapons = CONFIG.weapons.filter((weapon, i) => !modelStatus.weapons[i]).map((weapon) => weapon.name);
  $('modelwarn').textContent = missing.length
    ? `⚠ Modelos de enemigos no encontrados (se usan marcadores): ${missing.join(', ')}`
    : `✔ Enemigos cargados${missingWeapons.length ? ` · Armas con marcador: ${missingWeapons.join(', ')}` : ''}`;

  resetGame();
  showScreen('T3zombies', 'Sobrevive, administra tus balas y llega a la zona de extracción.', 'COMENZAR');
  updateHUD();
  loop();
})();
