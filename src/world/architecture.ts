import * as THREE from 'three';
import { buildFestival } from './festival';
import { weatherSurface } from './surfaces';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  islands,
  festivalIsland,
  festivalBridge,
  registrationSign,
  terrace,
  canal,
  walkways,
  walkwayPoint,
  surfaceHeight,
} from './map';
import type { Walkway } from './map';
import type { Obstacle } from './map';

let seed = 721;
export function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const materials = {
  cliff: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  timber: new THREE.MeshStandardMaterial({ color: '#503b35', roughness: 0.87 }),
  trim: new THREE.MeshStandardMaterial({ color: '#98745c', roughness: 0.8 }),
  plaster: new THREE.MeshStandardMaterial({ color: '#d2c4a2', roughness: 1 }),
  roof: new THREE.MeshStandardMaterial({ color: '#253f4a', roughness: 0.65, metalness: 0.15 }),
  tile: new THREE.MeshStandardMaterial({ color: '#3c5660', roughness: 0.75 }),
  stone: new THREE.MeshStandardMaterial({ color: '#7e8589', roughness: 1 }),
  darkStone: new THREE.MeshStandardMaterial({ color: '#4f616b', roughness: 1 }),
  path: new THREE.MeshStandardMaterial({ color: '#a09c95', roughness: 1 }),
  path2: new THREE.MeshStandardMaterial({ color: '#92918b', roughness: 1 }),
  moss: new THREE.MeshStandardMaterial({ color: '#6f826c', roughness: 1 }),
  red: new THREE.MeshStandardMaterial({ color: '#b54f39', roughness: 0.67 }),
  black: new THREE.MeshStandardMaterial({ color: '#24353c', roughness: 0.65 }),
  gold: new THREE.MeshStandardMaterial({ color: '#caa96d', metalness: 0.45, roughness: 0.45 }),
  window: new THREE.MeshStandardMaterial({
    color: '#f3bf7e',
    emissive: '#ff9f48',
    emissiveIntensity: 0.7,
    roughness: 0.65,
  }),
  lantern: new THREE.MeshStandardMaterial({
    color: '#ffd49a',
    emissive: '#ff953d',
    emissiveIntensity: 1.9,
    roughness: 0.8,
  }),
  pink: new THREE.MeshStandardMaterial({ color: '#dca4b9', roughness: 1 }),
  blossom: new THREE.MeshStandardMaterial({ color: '#edbdc7', roughness: 1 }),
  green: new THREE.MeshStandardMaterial({ color: '#547b6b', roughness: 1 }),
  cloth: new THREE.MeshStandardMaterial({ color: '#395c70', roughness: 1, side: THREE.DoubleSide }),
};
for (const key of ['timber', 'trim', 'red'] as const) weatherSurface(materials[key], 'wood');
for (const key of ['stone', 'darkStone', 'path', 'path2', 'plaster'] as const)
  weatherSurface(materials[key], 'stone');
weatherSurface(materials.roof, 'roof');
weatherSurface(materials.moss, 'earth');
type Mat = keyof typeof materials;

/** Static geometry is batched by material: thousands of details, a few dozen draw calls. */
export class Builder {
  batches = new Map<Mat, THREE.BufferGeometry[]>();
  group = new THREE.Group();
  add(
    geo: THREE.BufferGeometry,
    mat: Mat,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rotation = 0,
  ) {
    const g = geo.clone();
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0)),
        new THREE.Vector3(sx, sy, sz),
      ),
    );
    // All batches have matching attributes, regardless of source primitive.
    g.deleteAttribute('uv');
    const nonIndexed = g.index ? g.toNonIndexed() : g;
    if (nonIndexed !== g) g.dispose();
    if (!this.batches.has(mat)) this.batches.set(mat, []);
    this.batches.get(mat)!.push(nonIndexed);
  }
  box(mat: Mat, x: number, y: number, z: number, w: number, h: number, d: number, r = 0) {
    this.add(box, mat, x, y, z, w, h, d, r);
  }
  ball(mat: Mat, x: number, y: number, z: number, w: number, h: number, d: number) {
    this.add(rock, mat, x, y, z, w, h, d, random() * 6);
  }
  beam(mat: Mat, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    const g = pole.clone();
    const delta = b.clone().sub(a);
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        a.clone().add(b).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          delta.clone().normalize(),
        ),
        new THREE.Vector3(radius, delta.length(), radius),
      ),
    );
    this.add(g, mat, 0, 0, 0);
    g.dispose();
  }
  finish() {
    for (const [mat, geometries] of this.batches) {
      const geometry = mergeGeometries(geometries);
      const mesh = new THREE.Mesh(geometry, materials[mat]);
      mesh.castShadow = mat !== 'window' && mat !== 'lantern';
      mesh.receiveShadow = true;
      this.group.add(mesh);
      geometries.forEach((g) => g.dispose());
    }
    this.batches.clear();
    return this.group;
  }
}
const box = new THREE.BoxGeometry(1, 1, 1);
const rock = new THREE.IcosahedronGeometry(1, 1);
const pole = new THREE.CylinderGeometry(1, 1, 1, 7);
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function roofGeometry(w: number, d: number, rise: number) {
  const p: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => p.push(...a, ...b, ...c);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const t = i / 8,
        u = (i + 1) / 8;
      const y = (v: number) => rise * (1 - v) ** 1.65 + 0.18 * v ** 9;
      const a = [-w * (0.34 + t * 0.16), y(t), (side * d * t) / 2];
      const b = [w * (0.34 + t * 0.16), y(t), (side * d * t) / 2];
      const c = [-w * (0.34 + u * 0.16), y(u), (side * d * u) / 2];
      const e = [w * (0.34 + u * 0.16), y(u), (side * d * u) / 2];
      if (side === 1) {
        triangle(a, c, b);
        triangle(b, c, e);
      } else {
        triangle(a, b, c);
        triangle(b, e, c);
      }
    }
  }
  for (const side of [-1, 1]) {
    const a = [side * w * 0.34, rise, 0],
      b = [(side * w) / 2, 0.18, -d / 2],
      c = [(side * w) / 2, 0.18, d / 2];
    if (side === 1) triangle(a, c, b);
    else triangle(a, b, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

export interface WorldObjects {
  group: THREE.Group;
  obstacles: Obstacle[];
  waters: THREE.Mesh[];
  steamSources: THREE.Vector3[];
  animateFestival: (time: number) => void;
}
export function buildArchitecture(): WorldObjects {
  seed = 721;
  const b = new Builder(),
    obstacles: Obstacle[] = [],
    waters: THREE.Mesh[] = [],
    steamSources: THREE.Vector3[] = [];
  function roof(x: number, y: number, z: number, w: number, d: number) {
    const rise = d * 0.28;
    const g = roofGeometry(w, d, rise);
    b.add(g, 'roof', x, y, z);
    g.dispose();
    b.box('tile', x, y + rise + 0.06, z, w * 0.72, 0.16, 0.2);
    for (const s of [-1, 1]) {
      b.box('tile', x, y + 0.16, z + (s * d) / 2, w + 0.15, 0.17, 0.2);
      b.beam('tile', vec(x - w * 0.36, y + rise, z), vec(x - w * 0.4, y + rise + 0.32, z), 0.13);
      b.beam('tile', vec(x + w * 0.36, y + rise, z), vec(x + w * 0.4, y + rise + 0.32, z), 0.13);
      // Narrow relief ribs follow the curved slope of each tiled roof.
      for (let xx = -w * 0.32; xx <= w * 0.32; xx += 0.32) {
        for (let i = 0; i < 5; i++) {
          const t = i / 5,
            u = (i + 1) / 5;
          const h = (v: number) => rise * (1 - v) ** 1.65 + 0.18 * v ** 9;
          b.beam(
            'tile',
            vec(x + xx, y + h(t) + 0.04, z + (s * d * t) / 2),
            vec(x + xx, y + h(u) + 0.04, z + (s * d * u) / 2),
            0.026,
          );
        }
      }
    }
  }
  function lantern(x: number, y: number, z: number, standing = false) {
    if (standing) {
      b.box('darkStone', x, y + 0.15, z, 0.65, 0.3, 0.65);
      b.box('timber', x, y + 0.85, z, 0.13, 1.6, 0.13);
      y += 1.6;
      b.box('lantern', x, y + 0.25, z, 0.35, 0.58, 0.35);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          b.box('timber', x + sx * 0.19, y + 0.25, z + sz * 0.19, 0.045, 0.65, 0.045);
      b.box('black', x, y + 0.6, z, 0.62, 0.11, 0.62);
      b.box('black', x, y - 0.05, z, 0.5, 0.08, 0.5);
    } else {
      b.add(new THREE.SphereGeometry(1, 12, 10), 'lantern', x, y, z, 0.27, 0.37, 0.27);
      for (const yy of [-0.3, 0.3]) b.box('gold', x, y + yy, z, 0.25, 0.06, 0.25);
      b.box('timber', x, y + 0.65, z, 0.025, 0.7, 0.025);
    }
  }
  function fence(x: number, y: number, z: number, w: number, rotation = 0, red = false) {
    const dir = vec(Math.cos(rotation), 0, -Math.sin(rotation));
    const mat = red ? 'red' : 'timber';
    for (const yy of [0.45, 1.1]) b.box(mat, x, y + yy, z, w, 0.12, 0.13, rotation);
    for (let i = -w / 2; i <= w / 2 + 0.05; i += 0.85) {
      b.box(mat, x + dir.x * i, y + 0.63, z + dir.z * i, 0.13, 1.35, 0.13);
    }
  }
  function house(
    x: number,
    ground: number,
    z: number,
    w: number,
    d: number,
    floors: number,
    main = false,
  ) {
    obstacles.push({ x, z, halfX: w / 2, halfZ: d / 2, baseY: ground, height: floors * 2.8 + 3 });
    b.box('darkStone', x, ground + 0.24, z, w + 0.7, 0.48, d + 0.7);
    for (let level = 0; level < floors; level++) {
      const y = ground + level * 2.8 + 0.48;
      const ww = w - level * 0.45,
        dd = d - level * 0.4;
      b.box('plaster', x, y + 1.2, z, ww, 2.4, dd);
      for (const zz of [-1, 1]) {
        const facade = z + zz * (dd / 2 + 0.035);
        b.box('timber', x, y + 0.33, facade, ww, 0.65, 0.12);
        for (const yy of [0.7, 2.15, 2.45])
          b.box('timber', x, y + yy, facade, ww + 0.08, 0.12, 0.15);
        const count = Math.floor(ww / 1.35);
        for (let j = 0; j < count; j++) {
          const xx = x + (j - (count - 1) / 2) * 1.3;
          b.box('window', xx, y + 1.43, facade + zz * 0.03, 0.95, 1.25, 0.025);
          for (let n = -1; n <= 1; n++)
            b.box('timber', xx + n * 0.32, y + 1.43, facade + zz * 0.055, 0.035, 1.3, 0.04);
          for (const yy of [1.12, 1.72])
            b.box('timber', xx, y + yy, facade + zz * 0.06, 1, 0.035, 0.045);
        }
        for (let xx = -ww / 2; xx <= ww / 2 + 0.02; xx += ww / 4)
          b.box('timber', x + xx, y + 1.2, facade, 0.13, 2.5, 0.2);
        if (level > 0) {
          b.box('timber', x, y - 0.05, facade + zz * 0.4, ww + 0.9, 0.17, 0.95);
          fence(x, y, facade + zz * 0.82, ww + 0.7);
        }
      }
      for (const sx of [-1, 1]) {
        const xx = x + sx * (ww / 2 + 0.025);
        for (const dz of [-dd / 3, 0, dd / 3]) {
          b.box('window', xx, y + 1.4, z + dz, 0.025, 1.1, 0.8);
          for (const offset of [-0.27, 0, 0.27])
            b.box('timber', xx + sx * 0.025, y + 1.4, z + dz + offset, 0.04, 1.15, 0.035);
          b.box('timber', xx, y + 1.4, z + dz, 0.05, 0.04, 0.86);
        }
        for (const dz of [-dd / 2, dd / 2]) b.box('timber', xx, y + 1.2, z + dz, 0.2, 2.5, 0.2);
        b.box('timber', xx, y + 0.4, z, 0.1, 0.7, dd);
      }
      roof(x, y + 2.5, z, ww + 1.6, dd + 1.6);
    }
    const front = z + d / 2;
    b.box('timber', x, ground + 0.6, front + 0.3, 2.3, 0.18, 1.4);
    b.box('stone', x, ground + 0.25, front + 0.95, 2.5, 0.25, 0.8);
    for (const dx of [-0.58, 0, 0.58])
      b.box('cloth', x + dx, ground + 2.05, front + 0.55, 0.55, 0.7, 0.04);
    for (const dx of [-w * 0.36, w * 0.36]) lantern(x + dx, ground + 2.1, front + 0.8);
    if (main) {
      roof(x, ground + floors * 2.8 + 1.5, z, w * 0.45, d * 0.5);
      b.box('gold', x, ground + floors * 2.8 + 3.15, z, 0.12, 1.2, 0.12);
    }
    steamSources.push(vec(x + w * 0.35, ground + floors * 2.8 + 2, z - d * 0.2));
  }
  function tree(x: number, y: number, z: number, size: number, cherry = true) {
    b.beam('timber', vec(x, y, z), vec(x + 0.25 * size, y + size * 1.7, z), size * 0.13);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4,
        reach = size * (0.6 + random() * 0.9),
        height = y + size * (1.5 + random() * 0.7);
      const xx = x + Math.cos(angle) * reach,
        zz = z + Math.sin(angle) * reach;
      b.beam('timber', vec(x + size * 0.15, y + size, z), vec(xx, height, zz), size * 0.055);
      for (let k = 0; k < 15; k++)
        b.ball(
          cherry ? (k % 2 ? 'pink' : 'blossom') : 'green',
          xx + (random() - 0.5) * size * 1.7,
          height + (random() - 0.3) * size * 0.55,
          zz + (random() - 0.5) * size * 1.6,
          size * (0.2 + random() * 0.17),
          size * (0.16 + random() * 0.12),
          size * (0.2 + random() * 0.17),
        );
    }
  }
  function island(x: number, y: number, z: number, radius: number, detail = true) {
    // Fractured, tapering cliff faces with per-face mineral color variation.
    const positions: number[] = [],
      colors: number[] = [];
    const count = 44,
      rings: THREE.Vector3[][] = [];
    const widths = [1, 1.03, 0.88, 0.53, 0.04],
      heights = [-0.1, -1.8, -radius * 0.38, -radius * 0.78, -radius * 1.12];
    const edge = Array.from({ length: count }, () => 0.93 + random() * 0.1);
    for (let ring = 0; ring < 5; ring++) {
      rings.push(
        Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2;
          const r = radius * widths[ring] * edge[i] * (ring > 1 ? 0.85 + random() * 0.25 : 1);
          return vec(
            Math.cos(angle) * r,
            heights[ring] - (ring > 0 ? random() * 1.4 : 0),
            Math.sin(angle) * r,
          );
        }),
      );
    }
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < count; i++) {
        const k = (i + 1) % count;
        for (const tri of [
          [rings[j][i], rings[j + 1][i], rings[j][k]],
          [rings[j][k], rings[j + 1][i], rings[j + 1][k]],
        ]) {
          const c = new THREE.Color('#6d7982')
            .lerp(new THREE.Color('#a29891'), random() * 0.45)
            .multiplyScalar(0.78 + random() * 0.35);
          for (const p of tri) {
            positions.push(p.x, p.y, p.z);
            colors.push(c.r, c.g, c.b);
          }
        }
      }
    const cliff = new THREE.BufferGeometry();
    cliff.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    cliff.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    cliff.computeVertexNormals();
    b.add(cliff, 'cliff', x, y, z);
    cliff.dispose();
    b.add(
      new THREE.CylinderGeometry(radius * 0.965, radius * 0.98, 0.25, 44),
      'moss',
      x,
      y - 0.1,
      z,
    );
    for (let i = 0; i < 35; i++) {
      const a = (i / 35) * Math.PI * 2,
        r = radius * (0.91 + random() * 0.05);
      b.ball(
        i % 3 ? 'darkStone' : 'stone',
        x + Math.cos(a) * r,
        y - 0.45,
        z + Math.sin(a) * r,
        0.7 + random() * 0.6,
        0.65 + random() * 0.5,
        0.7 + random() * 0.4,
      );
      if (detail && i % 3 === 0) {
        b.ball('moss', x + Math.cos(a) * r, y + 0.01, z + Math.sin(a) * r, 1.2, 0.17, 0.8);
        b.ball('green', x + Math.cos(a) * r, y + 0.2, z + Math.sin(a) * r, 0.35, 0.3, 0.4);
      }
    }
    if (radius > 30) {
      // Tall, irregular mineral columns break up the large island's cliff silhouette.
      for (let i = 0; i < 110; i++) {
        const a = (i / 110) * Math.PI * 2;
        const reach = radius * (0.84 + random() * 0.11);
        b.ball(
          i % 3 ? 'darkStone' : 'stone',
          x + Math.cos(a) * reach,
          y - 16 - random() * 15,
          z + Math.sin(a) * reach,
          1.4 + random() * 2,
          5 + random() * 10,
          1.4 + random() * 2,
        );
        if (i % 3 === 0)
          b.ball('moss', x + Math.cos(a) * reach, y - 1, z + Math.sin(a) * reach, 2.3, 0.7, 1.8);
      }
    }
    if (detail) {
      // Broad cross-shaped streets link all island exits, with individual irregular pavers.
      for (let xx = -radius + 1; xx < radius; xx += 1.25)
        for (let zz = -radius + 1; zz < radius; zz += 1.25) {
          if (xx * xx + zz * zz < (radius - 0.6) ** 2 && (Math.abs(xx) < 3 || Math.abs(zz) < 3)) {
            b.box(
              random() > 0.5 ? 'path' : 'path2',
              x + xx + random() * 0.07,
              y + 0.08,
              z + zz,
              1.18,
              0.15,
              1.18,
              (random() - 0.5) * 0.055,
            );
          }
        }
    }
  }
  for (const platform of islands.filter((i) => i.id !== festivalIsland.id))
    island(platform.x, platform.y, platform.z, platform.radius, false);
  // A shared bedrock connects the upper town, lower shelf and switchback buttresses.
  b.ball('darkStone', 0, -58, 45, 68, 35, 98);
  for (const side of [-1, 1])
    b.add(new THREE.CylinderGeometry(7, 12, 48, 14), 'darkStone', side * 64, -36, 74);
  // Retaining walls and a six-meter terrace give the main inn a clear silhouette.
  b.box(
    'darkStone',
    terrace.x,
    terrace.y / 2 - 0.1,
    terrace.z,
    terrace.halfX * 2,
    terrace.y,
    terrace.halfZ * 2,
  );
  b.box('path', 0, terrace.y - 0.04, terrace.z, 28, 0.18, 28);
  for (let x = -13; x <= 13; x += 1.3)
    for (let y = 0.45; y < 6; y += 0.65)
      b.box(
        y % 1.3 < 0.7 ? 'stone' : 'darkStone',
        x + (y % 1.3 < 0.7 ? 0 : 0.3),
        y,
        -18.98,
        1.23,
        0.59,
        0.18,
      );

  function paving(x: number, z: number, w: number, d: number, y = 0) {
    for (let xx = x - w / 2; xx < x + w / 2; xx += 1.2)
      for (let zz = z - d / 2; zz < z + d / 2; zz += 1.2) {
        if (
          surfaceHeight(xx, zz, y + 0.15) === null ||
          Math.abs(surfaceHeight(xx, zz, y + 0.15)! - y - 0.15) > 0.2
        )
          continue;
        if (
          Math.abs(xx - canal.x) < canal.width / 2 + 0.45 &&
          Math.abs(zz - canal.z) < canal.length / 2 + 0.4
        )
          continue;
        b.box(
          random() > 0.5 ? 'path' : 'path2',
          xx,
          y + 0.055,
          zz,
          1.13,
          0.14,
          1.13,
          (random() - 0.5) * 0.035,
        );
      }
  }
  paving(0, 22, 8, 62);
  paving(0, 16, 88, 7);
  paving(0, -12, 88, 6);
  paving(-22, -1, 5, 78);
  paving(39, 6, 5, 62);
  paving(16.8, -12, 4.2, 48);
  paving(27.3, -12, 4.2, 48);
  paving(22, -36, 16, 4);
  paving(23, 30, 35, 5);
  paving(-22, 27, 43, 5);
  paving(0, -23, 26, 7, 6);
  // A continuous promenade follows the cliff rim, with a railing on the outside.
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    const x = Math.cos(a) * 71.8,
      z = Math.sin(a) * 71.8;
    b.box('path2', x, 0.025, z, 2.0, 0.14, 3.8, -a - Math.PI / 2);
    if (
      i % 2 === 0 &&
      !(Math.abs(Math.abs(x) - 52) < 6 && z > 44 && z < 59) &&
      !(x < -70 && Math.abs(z) < 4)
    )
      fence(Math.cos(a) * 73.8, 0, Math.sin(a) * 73.8, 3.8, -a - Math.PI / 2);
    if (i % 9 === 0) lantern(x, 0, x < -70 && Math.abs(z) < 4 ? z + 3 : z, true);
  }
  // The public avenue leaves a wide view of the crown of the island.
  for (const [x, z, floors, w, d] of [
    [-9, 36, 3, 6.8, 6],
    [9, 36, 2, 6.4, 6],
    [-9, 25, 3, 6.8, 6],
    [9, 25, 3, 6.4, 6],
    [-9, 6, 4, 7, 7],
    [9, 6, 3, 6.5, 6],
    [-9, -4, 4, 7, 6],
    [9, -4, 4, 6.5, 6],
    [-32, 36, 2, 6, 5],
    [-21, 36, 3, 7, 6],
    [-20, 44, 2, 6, 5],
    [-31, 20, 3, 7, 5],
    [-20, 20, 3, 7, 5],
    [-32, 6, 3, 7, 6],
    [-22, 6, 2, 6, 6],
    [-43, 6, 2, 6, 6],
    [-32, -3, 3, 7, 5],
    [-22, -3, 4, 6, 5],
    [-43, -3, 2, 5, 5],
    [-22, -22, 4, 6, 6],
    [-22, -33, 3, 6, 6],
    [-34, -34, 3, 6, 6],
    [-24, -43, 2, 6, 5],
    [20, 40, 2, 6, 5],
    [37, 24, 2, 6, 5],
    [44, -7, 3, 6, 6],
    [43, -20, 3, 6, 6],
    [37, -33, 3, 6, 5],
  ])
    house(x, 0, z, w, d, floors);

  // Narrow, tall canal district. Both banks and every cross street remain open.
  for (const [index, z] of [-30, -21, -3, 7].entries()) {
    house(11, 0, z, 5.4, 5.5, 4 + (index % 2));
    house(33, 0, z, 5.4, 5.5, 5 + (index % 2));
  }
  // The landmark is supplied by the editable Blender asset.
  obstacles.push({ x: 0, z: -35, halfX: 10, halfZ: 7, baseY: 6, height: 26 });
  house(-9.5, 6, -43, 5, 4, 2);
  house(9.5, 6, -43, 5, 4, 2);
  fence(-8.5, 6, -19.1, 10, 0, true);
  fence(8.5, 6, -19.1, 10, 0, true);
  for (const x of [-13.7, 13.7]) fence(x, 6, -33, 27, Math.PI / 2);
  fence(0, 6, -46.7, 27);

  function bridge(w: Walkway, overhead = false) {
    const angle = Math.atan2(w.bx - w.ax, w.bz - w.az);
    const normal = vec(Math.cos(angle), 0, -Math.sin(angle));
    const point = (t: number, side = 0, height = 0) => {
      const p = walkwayPoint(w, t);
      return vec(p.x + normal.x * side, p.y + height, p.z + normal.z * side);
    };
    const count = Math.ceil(Math.hypot(w.bx - w.ax, w.bz - w.az) / 0.25);
    if (w.kind === 'slope') {
      const positions: number[] = [];
      for (let i = 0; i < count; i++) {
        const a = point(i / count, -w.width / 2),
          c = point(i / count, w.width / 2);
        const d = point((i + 1) / count, -w.width / 2),
          e = point((i + 1) / count, w.width / 2);
        for (const p of [a, d, c, c, d, e]) positions.push(p.x, p.y, p.z);
        if (i % 5 === 0)
          b.beam(
            'darkStone',
            a.clone().add(vec(0, 0.012, 0)),
            c.clone().add(vec(0, 0.012, 0)),
            0.018,
          );
      }
      const deck = new THREE.BufferGeometry();
      deck.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      deck.computeVertexNormals();
      b.add(deck, 'path', 0, 0, 0);
      deck.dispose();
      for (const t of [0.2, 0.5, 0.8]) {
        const p = point(t);
        b.beam('darkStone', p.clone().add(vec(0, -1, 0)), vec(p.x, -38, p.z), 1.1);
      }
    } else
      for (let i = 0; i <= count; i++) {
        const p = point(i / count);
        b.box('trim', p.x, p.y, p.z, w.width, 0.2, 0.27, angle);
      }
    for (const side of [-w.width / 2, w.width / 2]) {
      for (let i = 0; i < count; i++)
        for (const h of [-0.45, 0.55, 1.1])
          b.beam(
            'red',
            point(i / count, side, h),
            point((i + 1) / count, side, h),
            h < 0 ? 0.22 : 0.075,
          );
      for (let i = 0; i <= count; i += 4) {
        const p = point(i / count, side, 0.55);
        b.box('red', p.x, p.y, p.z, 0.16, 1.35, 0.16);
        b.ball('black', p.x, p.y + 0.74, p.z, 0.13, 0.13, 0.13);
      }
    }
    if (!overhead)
      for (const t of [0, 1]) {
        const p = point(t, w.width / 2 + 0.45);
        lantern(p.x, p.y, p.z, true);
      }
  }
  walkways.filter((w) => w.id !== festivalBridge.id).forEach((w) => bridge(w));
  // Upper bridges are architectural connections, with no accessible upper interiors.
  for (const [z, y] of [
    [-21, 9],
    [-3, 12],
  ])
    bridge(
      { id: 'upper', ax: 13.5, az: z, bx: 30.5, bz: z, ay: y, by: y, width: 2.2, arch: 1.3 },
      true,
    );

  function waterSurface(
    x: number,
    y: number,
    z: number,
    geometry: THREE.BufferGeometry,
    isCanal = false,
  ) {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, canal: { value: isCanal ? 1 : 0 } },
        transparent: true,
        vertexShader:
          'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform float time; uniform float canal; varying vec2 vUv;
        void main(){vec2 p=vUv-.5; float wave=sin(p.y*130.-time*1.7+sin(p.x*30.+time)*1.2)*.5+.5;
        float caustic=pow(max(0.,sin(p.x*37.+sin(p.y*21.+time))*sin(p.y*34.-time*.6)),6.);
        vec3 col=mix(vec3(.045,.30,.34),vec3(.18,.67,.65),wave*.18+.35);
        col=mix(col,vec3(.008,.035,.065)+vec3(.012,.03,.045)*wave,canal);
        float reflection=pow(max(0.,sin(p.y*82.)),20.)*pow(abs(p.x)*2.,5.);
        col+=vec3(.9,.44,.12)*reflection*canal+vec3(.23,.46,.4)*caustic*.3;
        gl_FragColor=vec4(col,.98);}`,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    waters.push(mesh);
    b.group.add(mesh);
  }
  waterSurface(canal.x, 0.21, canal.z, new THREE.PlaneGeometry(canal.width, canal.length), true);
  for (const x of [canal.x - canal.width / 2 - 0.12, canal.x + canal.width / 2 + 0.12]) {
    b.box('darkStone', x, 0.12, canal.z, 0.3, 0.45, canal.length + 0.6);
    for (let z = -33; z <= 9; z += 1.5) {
      if (walkways.some((w) => w.id.startsWith('canal-bridge-') && Math.abs(w.az - z) < 2.1))
        continue;
      b.box('timber', x, 0.6, z, 0.12, 1.2, 0.12);
      b.box('timber', x, 0.9, z, 0.09, 0.1, 1.55);
    }
  }
  for (const z of [-31, -18, -6, 8]) {
    for (let i = 0; i < 24; i++) {
      const x = 14 + i * 0.67;
      const h = (v: number) => 7.5 - Math.sin(((v - 14) / 16) * Math.PI) * 1.8;
      b.beam('black', vec(x, h(x), z), vec(x + 0.67, h(x + 0.67), z), 0.022);
      if (i % 4 === 1) lantern(x, h(x) - 0.5, z);
    }
  }
  function pool(x: number, z: number, r: number) {
    obstacles.push({ x, z, halfX: r + 0.15, halfZ: r + 0.15 });
    b.add(new THREE.CylinderGeometry(r + 0.5, r + 0.6, 0.5, 40), 'darkStone', x, 0.1, z);
    waterSurface(x, 0.39, z, new THREE.CircleGeometry(r, 48));
    const count = Math.ceil(r * 7);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      b.ball(
        i % 3 ? 'darkStone' : 'stone',
        x + Math.cos(a) * (r + 0.1),
        0.5,
        z + Math.sin(a) * (r + 0.1),
        0.6,
        0.4 + random() * 0.2,
        0.55,
      );
    }
    for (const dx of [-r / 2, r / 2]) steamSources.push(vec(x + dx, 0.6, z));
  }
  pool(46, 5, 4.6);
  pool(34, 33, 3.5);
  pool(23, 25, 2.3);
  pool(29, 22, 1.8);
  for (const x of [44, 48]) for (const z of [10, 13]) b.box('timber', x, 1.7, z, 0.18, 3.4, 0.18);
  roof(46, 3.5, 11.5, 6, 5);

  // The enlarged upper town has a new southern avenue and a northern inn district.
  paving(0, 52, 111, 7);
  paving(0, 61, 6, 21);
  paving(0, -54, 94, 6);
  paving(-50, -14, 6, 82);
  paving(50, -14, 6, 82);
  paving(-53, 39, 6, 28);
  paving(53, 39, 6, 28);
  paving(-46, 27, 26, 5);
  paving(45, 30, 23, 5);
  paving(0, -64, 6, 17);
  for (const side of [-1, 1]) {
    for (const [x, z, floors] of [
      [12, 61, 3],
      [23, 60, 3],
      [35, 59, 2],
      [45, 43, 3],
      [61, 15, 3],
      [60, -3, 4],
      [58, -23, 3],
      [43, -45, 3],
      [31, -50, 4],
      [17, -56, 3],
      [10, -64, 2],
    ]) {
      house(side * x, 0, z, 6.3, 5.4, floors);
    }
    for (const x of [12, 26, 40, 51]) lantern(side * x, 0, 49, true);
    tree(side * 28, 0, 49, 2.5);
    tree(side * 46, 0, 52, 2.1);
    tree(side * 55, 0, -37, 2.6);
    tree(side * 30, 0, -61, 2.3);
  }

  // Midway balconies are part of the same rock mass, with a clear turning area.
  for (const side of [-1, 1]) {
    paving(side * 64, 74, 12, 17, -9);
    house(side * 69, -9, 74, 3.7, 4.2, 2);
    tree(side * 61, -9, 74, 1.5);
    for (const z of [69, 77]) lantern(side * 61, -9, z, true);
    fence(side * 72, -9, 74, 9, Math.PI / 2, true);
  }

  // The lower quarter nestles against the southern cliff, eighteen meters down.
  // The northern edge is the retaining wall; all public streets lie south of it.
  b.box('darkStone', 0, -10, 79.7, 76, 16, 1.8);
  for (let x = -36; x <= 36; x += 2.1)
    for (let y = -17; y < -3; y += 1.3)
      b.box('stone', x + (Math.floor(y) % 2) * 0.35, y, 80.68, 1.95, 1.17, 0.18);
  paving(0, 104, 78, 7, -18);
  paving(0, 111, 7, 53, -18);
  paving(0, 86, 67, 5, -18);
  paving(0, 121, 66, 5, -18);
  paving(-24, 111, 5, 49, -18);
  paving(24, 111, 5, 49, -18);
  paving(-36, 100, 8, 10, -18);
  paving(36, 100, 8, 10, -18);
  for (const side of [-1, 1]) {
    for (const [x, z, w, floors] of [
      [10, 93, 6.4, 4],
      [18, 93, 5.6, 3],
      [32, 93, 6.2, 4],
      [10, 113, 6.4, 3],
      [18, 113, 5.6, 4],
      [32, 113, 6.2, 3],
      [9, 131, 6, 3],
      [18, 129, 5.4, 2],
    ]) {
      house(side * x, -18, z, w, 6, floors);
    }
    for (const x of [7, 16, 26, 35]) lantern(side * x, -18, 100, true);
    for (const z of [88, 108, 122, 135]) lantern(side * 4.2, -18, z, true);
    tree(side * 28, -18, 124, 2.1);
    tree(side * 35, -18, 86, 1.6);
    // Market counters, stools and hanging noren face the main cross street.
    for (const x of [8, 16, 30]) {
      const xx = side * x;
      b.box('trim', xx, -17.05, 98.5, 3, 0.15, 0.9);
      for (const dx of [-1.2, 1.2]) b.box('timber', xx + dx, -17.5, 98.5, 0.12, 1, 0.75);
      for (const dx of [-0.9, 0, 0.9]) {
        b.box('cloth', xx + dx, -15.5, 98.5, 0.82, 0.7, 0.04);
        b.ball('gold', xx + dx, -16.82, 98.5, 0.15, 0.15, 0.15);
      }
      for (const dx of [-1.4, 1.4]) b.box('timber', xx + dx, -16.7, 98.5, 0.13, 2.6, 0.13);
      roof(xx, -15.3, 98.5, 3.7, 2.2);
      obstacles.push({ x: xx, z: 98.5, halfX: 1.5, halfZ: 0.45, baseY: -18, height: 2.8 });
    }
  }
  for (const z of [101, 117, 127]) {
    for (const x of [-5, 5]) b.box('timber', x, -15.3, z, 0.15, 5.4, 0.15);
    for (let i = 0; i < 20; i++) {
      const x = -5 + i * 0.5;
      const h = (xx: number) => -12.8 - Math.sin(((xx + 5) / 10) * Math.PI);
      b.beam('black', vec(x, h(x), z), vec(x + 0.5, h(x + 0.5), z), 0.02);
      if (i % 3 === 1) lantern(x, h(x) - 0.4, z);
    }
  }
  // A lower promenade follows the exposed crescent, with openings at the two ramps.
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const x = Math.cos(a) * 39,
      z = 100 + Math.sin(a) * 39;
    if (z < 82) continue;
    b.box('path2', x, -17.975, z, 2.8, 0.14, 3.2, -a - Math.PI / 2);
    if (Math.abs(z - 99) > 4)
      fence(Math.cos(a) * 40.3, -18, 100 + Math.sin(a) * 40.3, 3, -a - Math.PI / 2, true);
    if (i % 7 === 0) lantern(x, -18, z, true);
  }

  // Shrine precinct and the cloud-facing tea terrace.
  house(-35, 0, -25, 7, 5, 2, true);
  for (const dx of [-2.1, 2.1]) {
    b.add(pole, 'red', -35 + dx, 2.3, -18.5, 0.21, 4.6, 0.21);
    b.add(pole, 'black', -35 + dx, 0.3, -18.5, 0.25, 0.6, 0.25);
  }
  b.box('red', -35, 3.6, -18.5, 5.3, 0.22, 0.24);
  b.box('red', -35, 4.4, -18.5, 6.1, 0.35, 0.45);
  b.box('black', -35, 4.65, -18.5, 6.5, 0.2, 0.55);
  paving(-35, -19, 11, 13);
  for (const x of [-42, -36]) for (const z of [29, 33]) b.box('timber', x, 1.6, z, 0.18, 3.2, 0.18);
  roof(-39, 3.3, 31, 8, 6);
  b.box('timber', -39, 0.6, 32, 4, 0.16, 0.8);
  fence(-41, 0, 28, 8, Math.PI / 2, true);

  for (const [x, z, size] of [
    [-13, 43, 2.6],
    [12, 43, 2.3],
    [-17, 29, 2.1],
    [16, 30, 2.4],
    [-16, 11, 2.2],
    [-37, 12, 2.6],
    [-45, 20, 2.6],
    [-45, -14, 2.7],
    [-42, -25, 2.4],
    [-29, -20, 2],
    [-15, -35, 2],
    [28, 37, 2.8],
    [39, 33, 2.5],
    [26, 18, 2.1],
    [43, 18, 2.2],
    [48, -1, 2],
    [41, -29, 2],
    [19, -39, 2.3],
  ])
    tree(x, 0, z, size);
  tree(-11, 6, -24, 2.2);
  tree(11, 6, -24, 2.2);
  for (const z of [46, 35, 23, 12, 1, -6]) for (const x of [-4.4, 4.4]) lantern(x, 0, z, true);
  for (const x of [-45, -35, -24, -13, 15, 28, 40]) lantern(x, 0, 13, true);
  for (const z of [-30, -19, -3, 8]) for (const x of [17, 27]) lantern(x, 0, z, true);
  for (const z of [30, 18]) {
    b.beam('black', vec(-5, 5, z), vec(5, 5, z), 0.025);
    for (const x of [-5, 5]) b.box('timber', x, 2.5, z, 0.16, 5, 0.16);
    for (let x = -4; x <= 4; x += 1.3) lantern(x, 4.6, z);
  }
  for (const [x, z] of [
    [-5, 25],
    [5, 35],
    [-27, 17],
    [37, 21],
    [14, -2],
  ]) {
    b.box('trim', x, 0.85, z, 1.5, 0.12, 0.65);
    for (const dx of [-0.6, 0.6]) b.box('timber', x + dx, 0.42, z, 0.1, 0.84, 0.5);
    for (let i = 0; i < 4; i++) b.ball('gold', x - 0.5 + i * 0.32, 1.01, z, 0.12, 0.12, 0.12);
  }
  for (const [x, z, rotation] of [
    [-2.8, 24, 0.4],
    [3, 17, -1],
    [-25, 14, 2],
    [28, -18, 1.3],
    [16.8, -17, -0.5],
    [37, 16, 2.3],
    [-37, 27, 1.5],
    [6, -23, 3],
  ]) {
    const guest = createTraveler();
    guest.group.position.set(x, z < -20 && x > -14 && x < 14 ? 6.15 : 0.15, z);
    guest.group.rotation.y = rotation;
    guest.group.updateMatrixWorld(true);
    const guestMaterials = new Set<THREE.Material>();
    guest.group.traverse((object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        !(object.material instanceof THREE.MeshStandardMaterial)
      )
        return;
      const color = object.material.color.getHexString();
      const mat: Mat =
        color === '426b82'
          ? 'cloth'
          : color === '202d38'
            ? 'black'
            : color === 'e3b792'
              ? 'trim'
              : 'gold';
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      b.add(geometry, mat, 0, 0, 0);
      geometry.dispose();
      object.geometry.dispose();
      guestMaterials.add(object.material);
    });
    guestMaterials.forEach((material) => material.dispose());
  }
  // A few far silhouettes frame the main island instead of competing with it.
  for (const [x, z, y, r] of [
    [-105, -95, -8, 10],
    [103, -110, -3, 12],
    [18, -158, 9, 11],
  ]) {
    island(x, y, z, r, false);
    house(x, y, z, r * 0.65, r * 0.5, 3, true);
    tree(x + r * 0.65, y, z, 2, false);
  }
  for (const [text, x, y, z] of [
    ['湯あかり表参道', 4, 0, 37],
    ['灯籠運河', 16, 0, 10],
    ['雲渡りの湯', 41, 0, 13],
    ['風待ち神社', -31, 0, -17],
    ['望雲楼', 4, 6, -24],
    ['桜泉の湯', 28, 0, 29],
    ['雲見の散歩道', -38, 0, 26],
    ['宵待ち横丁へ', -48, 0, 52],
    ['宵待ち横丁へ', 48, 0, 52],
    ['九折坂', -66, -9, 70],
    ['宵待ち横丁', 4, -18, 104],
    ['上の町へ', -35, -18, 102],
    ['上の町へ', 35, -18, 102],
  ] as const) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e5c895';
    ctx.fillRect(0, 0, 128, 512);
    ctx.strokeStyle = '#594436';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 112, 496);
    ctx.fillStyle = '#473c34';
    ctx.font = '52px serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < text.length; i++) ctx.fillText(text[i], 64, 85 + i * 67);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 2.2),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 1,
        emissive: '#b87b39',
        emissiveIntensity: 0.12,
      }),
    );
    sign.position.set(x, y + 2, z + 0.07);
    b.group.add(sign);
    b.box('timber', x, y + 1.8, z, 0.64, 2.7, 0.12);
    b.box('timber', x, y + 0.6, z, 0.12, 1.2, 0.12);
  }
  // A roofed wooden notice board beside the arriving traveler.
  {
    const { x, y, z } = registrationSign;
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#bc915c';
    ctx.fillRect(0, 0, 768, 1024);
    // Fine, uneven grain and plank seams keep the face wooden rather than poster-like.
    for (let i = 0; i < 95; i++) {
      const row = i * 11;
      ctx.strokeStyle = i % 3 ? '#996a3633' : '#e8c68b44';
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(0, row);
      ctx.bezierCurveTo(210, row + Math.sin(i) * 9, 540, row - 6, 768, row + 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#75502b66';
    for (const row of [256, 512, 768]) ctx.fillRect(0, row, 768, 3);
    ctx.strokeStyle = '#654125';
    ctx.lineWidth = 12;
    ctx.strokeRect(22, 22, 724, 980);
    ctx.fillStyle = '#35291e';
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText('Resident', 384, 112);
    ctx.fillText('Registration', 384, 180);
    ctx.font = 'bold 132px "Noto Serif JP", serif';
    [...'町民登録'].forEach((letter, i) => ctx.fillText(letter, 384, 370 + i * 148));
    ctx.font = '36px Georgia, serif';
    ctx.fillText('Reserve your username', 384, 948);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.65, 2.2),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
    );
    sign.position.set(x, y + 1.95, z + 0.15);
    b.group.add(sign);
    b.box('timber', x, y + 1.95, z, 1.8, 2.35, 0.26);
    for (const dx of [-0.96, 0.96]) {
      b.box('timber', x + dx, y + 1.55, z, 0.18, 3.1, 0.22);
      b.box('stone', x + dx, y + 0.13, z, 0.38, 0.26, 0.42);
    }
    b.box('timber', x, y + 0.65, z, 2.1, 0.16, 0.26);
    roof(x, y + 3.16, z, 2.4, 1);
    obstacles.push({ x, z, halfX: 1.15, halfZ: 0.22 });
  }
  // Append after the original scene so its seeded terrain and details stay identical.
  island(festivalIsland.x, festivalIsland.y, festivalIsland.z, festivalIsland.radius, false);
  bridge(festivalBridge);
  const animateFestival = buildFestival(b, obstacles, {
    roof,
    tree,
    lantern,
    paving,
    fence,
    traveler: createTraveler,
  });
  return { group: b.finish(), obstacles, waters, steamSources, animateFestival };
}

export function createTraveler() {
  const g = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: '#426b82', roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#202d38', roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e3b792', roughness: 1 });
  const sash = new THREE.MeshStandardMaterial({ color: '#d9c6a0', roughness: 0.9 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.25, 0.4, 0.85, 10), fabric, 0, 0.86, 0);
  add(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), sash, 0, 1.12, 0);
  add(new THREE.SphereGeometry(0.22, 12, 10), skin, 0, 1.62, 0);
  const hair = add(
    new THREE.SphereGeometry(0.237, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
    dark,
    0,
    1.69,
    -0.01,
  );
  hair.rotation.x = -0.15;
  const left = add(new THREE.BoxGeometry(0.13, 0.5, 0.17), dark, -0.14, 0.29, 0);
  const right = add(new THREE.BoxGeometry(0.13, 0.5, 0.17), dark, 0.14, 0.29, 0);
  add(new THREE.BoxGeometry(0.17, 0.08, 0.28), sash, -0.14, 0.07, 0.05);
  add(new THREE.BoxGeometry(0.17, 0.08, 0.28), sash, 0.14, 0.07, 0.05);
  const la = add(new THREE.CylinderGeometry(0.15, 0.18, 0.56, 8), fabric, -0.34, 1.07, 0);
  la.rotation.z = -0.14;
  const ra = add(new THREE.CylinderGeometry(0.15, 0.18, 0.56, 8), fabric, 0.34, 1.07, 0);
  ra.rotation.z = 0.14;
  add(new THREE.SphereGeometry(0.085, 8, 6), skin, -0.38, 0.77, 0);
  add(new THREE.SphereGeometry(0.085, 8, 6), skin, 0.38, 0.77, 0);
  add(new THREE.BoxGeometry(0.24, 0.24, 0.13), sash, 0, 1.1, -0.28);
  return { group: g, left, right, la, ra };
}
