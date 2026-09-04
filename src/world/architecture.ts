import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { islands, connections } from './map';
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
type Mat = keyof typeof materials;

/** Static geometry is batched by material: thousands of details, a few dozen draw calls. */
class Builder {
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
    obstacles.push({ x, z, halfX: w / 2, halfZ: d / 2 });
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
      for (let k = 0; k < 3; k++)
        b.ball(
          cherry ? (k % 2 ? 'pink' : 'blossom') : 'green',
          xx + (random() - 0.5) * size,
          height + random() * size * 0.25,
          zz + (random() - 0.5) * size,
          size * 0.75,
          size * 0.35,
          size * 0.65,
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
  for (const i of islands) island(i.x, i.y, i.z, i.radius);
  // A dense, layered village with a clear walkable central street.
  house(-7.6, 0, 6, 5.3, 4.6, 2);
  house(7.6, 0, 5.5, 5.4, 4.6, 2);
  house(-8.3, 0, -2.1, 5.8, 4.8, 3);
  house(8.3, 0, -2.7, 5.6, 4.7, 2);
  house(-7.2, 0, -10, 5.2, 4.5, 2);
  house(7.1, 0, -10, 5.1, 4.2, 3);
  house(2, 4, -46, 10, 7, 4, true);
  house(-6, 4, -40, 4.2, 4, 2);
  house(10, 4, -40, 4, 4.5, 2);
  house(36, 1, 1.7, 6.6, 4.2, 2);
  house(-34, 2, -21, 5.5, 4.5, 1);
  // Outdoor onsen: rocky ring, animated water and wooden pavilion.
  const poolX = 37,
    poolZ = 10,
    poolY = 1.2;
  obstacles.push({ x: poolX, z: poolZ, halfX: 3.35, halfZ: 2.9 });
  b.add(new THREE.CylinderGeometry(4.7, 4.7, 0.45, 40), 'darkStone', poolX, poolY, poolZ);
  for (let i = 0; i < 27; i++) {
    const t = (i / 27) * Math.PI * 2;
    b.ball(
      i % 2 ? 'stone' : 'darkStone',
      poolX + Math.cos(t) * 4.4,
      poolY + 0.4,
      poolZ + Math.sin(t) * 4.4,
      0.7,
      0.45 + random() * 0.3,
      0.6,
    );
  }
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(4.25, 64),
    new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      transparent: true,
      vertexShader:
        'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float time; varying vec2 vUv;
      void main(){vec2 p=vUv-.5;float d=length(p);float wave=sin(d*90.-time*1.4+sin(p.x*22.+time)*1.5)*.5+.5;
      float caustic=pow(max(0.,sin(p.x*37.+sin(p.y*21.+time))*sin(p.y*34.-time*.6)),6.);
      vec3 col=mix(vec3(.055,.37,.41),vec3(.22,.79,.77),wave*.25+(1.-d*1.8)*.45);
      col+=vec3(.32,.6,.55)*caustic*.32;gl_FragColor=vec4(col,.95);}`,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(poolX, poolY + 0.27, poolZ);
  waters.push(water);
  b.group.add(water);
  steamSources.push(
    vec(poolX - 2, 1.6, poolZ),
    vec(poolX + 2, 1.6, poolZ),
    vec(poolX, 1.6, poolZ + 2),
  );
  for (const dx of [-1.7, 1.7])
    for (const dz of [-1.4, 1.4]) b.box('timber', 41 + dx, 2.6, 7 + dz, 0.16, 3, 0.16);
  roof(41, 4.15, 7, 4.6, 4.3);
  // Shrine torii.
  for (const dx of [-2.1, 2.1]) {
    b.add(pole, 'red', -32 + dx, 4.3, -15.8, 0.21, 4.6, 0.21);
    b.add(pole, 'black', -32 + dx, 2.35, -15.8, 0.25, 0.6, 0.25);
  }
  b.box('red', -32, 5.55, -15.8, 5.3, 0.22, 0.24);
  b.box('red', -32, 6.35, -15.8, 6.1, 0.35, 0.45);
  b.box('black', -32, 6.6, -15.8, 6.5, 0.2, 0.55);
  b.box('gold', -32, 5.95, -15.55, 0.46, 0.62, 0.09);
  // Arched bridges, each plank and rail follows the same surface as the player.
  for (const [ai, bi] of connections) {
    const a = islands[ai],
      c = islands[bi];
    const dx = c.x - a.x,
      dz = c.z - a.z,
      len = Math.hypot(dx, dz);
    const start = (a.radius - 2) / len,
      end = 1 - (c.radius - 2) / len;
    const angle = Math.atan2(dx, dz),
      perpendicular = vec(Math.cos(angle), 0, -Math.sin(angle));
    const point = (t: number, side = 0, h = 0) =>
      vec(
        a.x + dx * (start + (end - start) * t) + perpendicular.x * side,
        a.y + (c.y - a.y) * t + Math.sin(Math.PI * t) * 1.6 + h,
        a.z + dz * (start + (end - start) * t) + perpendicular.z * side,
      );
    const count = Math.ceil((len * (end - start)) / 0.33);
    for (let i = 0; i <= count; i++) {
      const p = point(i / count);
      b.box('trim', p.x, p.y, p.z, 4.2, 0.2, 0.3, angle);
    }
    for (const side of [-2.05, 2.05]) {
      for (let i = 0; i < 24; i++)
        for (const h of [-0.4, 0.55, 1.15])
          b.beam('red', point(i / 24, side, h), point((i + 1) / 24, side, h), h < 0 ? 0.18 : 0.08);
      for (let i = 0; i <= 12; i++) {
        const p = point(i / 12, side, 0.65);
        b.box('red', p.x, p.y, p.z, 0.17, 1.5, 0.17);
        b.ball('black', p.x, p.y + 0.8, p.z, 0.16, 0.16, 0.16);
      }
    }
    for (const t of [0, 1])
      for (const side of [-2.5, 2.5]) {
        const p = point(t, side);
        lantern(p.x, p.y, p.z, true);
      }
  }
  for (const [x, z, y, size] of [
    [-13, 8, 0, 2.2],
    [13, 9, 0, 2.1],
    [-13, -7, 0, 2.6],
    [12, -9, 0, 2],
    [-38, -16, 2, 2.5],
    [-28, -23, 2, 1.8],
    [42, 12, 1, 2.2],
    [30, 2, 1, 1.5],
    [-7, -49, 4, 2.4],
    [11, -46, 4, 2.1],
  ])
    tree(x, y, z, size);
  for (const [x, z, y] of [
    [-14, 1, 0],
    [15, 1, 0],
    [-4, 13, 0],
    [8, 13, 0],
    [-39, -22, 2],
    [29, 12, 1],
    [-3, -31, 4],
  ])
    tree(x, y, z, 1.6, false);
  for (const z of [12, 5, -3, -11]) for (const x of [-3.3, 3.3]) lantern(x, 0, z, true);
  lantern(31, 1, 14, true);
  lantern(-28, 2, -12, true);
  lantern(2, 4, -33, true);
  // Lantern garlands across the street.
  for (const z of [4, -5]) {
    for (const x of [-5, 5]) b.box('timber', x, 3, z, 0.12, 6, 0.12);
    for (let i = 0; i < 20; i++) {
      const x = -5 + i * 0.5,
        h = 5.8 - (1 - (x / 5) ** 2) * 0.9;
      const next = x + 0.5,
        nh = 5.8 - (1 - (next / 5) ** 2) * 0.9;
      b.beam('timber', vec(x, h, z), vec(next, nh, z), 0.014);
      if (i % 3 === 1) lantern(x, h - 0.4, z);
    }
  }
  // Balustrades frame viewpoints, leaving bridge entrances open.
  fence(-7, 0, 13, 6);
  fence(7, 0, 13, 6);
  fence(36, 1, 15.3, 9);
  fence(-33, 2, -10, 7);
  // Remote islands create depth and the feeling of a larger archipelago.
  for (const [x, z, y, r] of [
    [-76, -64, 0, 9],
    [65, -75, 12, 12],
    [-35, -105, 19, 13],
    [40, -132, 12, 10],
    [98, -35, -4, 12],
    [-90, 15, -8, 10],
  ]) {
    island(x, y, z, r, false);
    house(x, y, z, r * 0.68, r * 0.5, 3, true);
    tree(x + r * 0.65, y, z, 2, false);
  }
  for (const [text, x, y, z] of [
    ['湯あかり', 3.5, 0, 9],
    ['雲渡りの湯', 30, 1, 12],
    ['風待ち神社', -28, 2, -14],
    ['望雲楼', 5, 4, -36],
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
  return { group: b.finish(), obstacles, waters, steamSources };
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
