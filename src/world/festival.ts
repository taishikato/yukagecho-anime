import * as THREE from 'three';
import type { createTraveler, Builder } from './architecture';
import { festivalIsland, type Obstacle } from './map';

type Details = {
  traveler: typeof createTraveler;
  roof: (x: number, y: number, z: number, w: number, d: number) => void;
  tree: (x: number, y: number, z: number, size: number, cherry?: boolean) => void;
  lantern: (x: number, y: number, z: number, standing?: boolean) => void;
  paving: (x: number, z: number, w: number, d: number, y?: number) => void;
  fence: (x: number, y: number, z: number, w: number, rotation?: number, red?: boolean) => void;
};

/** The courtyard is scenery with ordinary walkable ground, independent of network or audio. */
export function buildFestival(b: Builder, obstacles: Obstacle[], detail: Details) {
  const { x, z } = festivalIsland;
  const v = (dx: number, y: number, dz: number) => new THREE.Vector3(x + dx, y, z + dz);
  const block = (dx: number, dz: number, halfX: number, halfZ: number, height = 3) =>
    obstacles.push({ x: x + dx, z: z + dz, halfX, halfZ, baseY: 0, height });
  detail.paving(x + 10, z, 20, 4);
  detail.paving(x, z + 1, 14, 15);
  detail.paving(-62, 0, 20, 4);

  // A low timber sanctuary with deep tiled eaves, veranda and sacred rope.
  b.box('darkStone', x, 0.22, z - 11, 10, 0.44, 7);
  b.box('timber', x, 0.5, z - 10.5, 9.7, 0.2, 7.3);
  b.box('plaster', x, 2.15, z - 11.6, 8, 3.1, 4.5);
  for (const dx of [-4, -2, 0, 2, 4]) {
    b.box('red', x + dx, 2.35, z - 8.2, 0.23, 3.7, 0.23);
    b.box('timber', x + dx, 2.1, z - 9.3, 0.14, 3.2, 0.16);
  }
  for (const dx of [-2.8, -1.4, 0, 1.4, 2.8]) {
    b.box('window', x + dx, 2, z - 9.32, 1.12, 2.15, 0.04);
    for (let i = -2; i <= 2; i++) b.box('timber', x + dx + i * 0.2, 2, z - 9.26, 0.035, 2.2, 0.06);
  }
  detail.roof(x, 4.15, z - 11, 12.5, 8.5);
  detail.roof(x, 3.65, z - 7.8, 5, 3);
  b.box('gold', x, 6.57, z - 11, 8, 0.16, 0.2);
  for (let i = 0; i < 20; i++) {
    const dx = -3 + i * 0.3;
    const h = (a: number) => 3.5 - Math.cos(((a / 3) * Math.PI) / 2) * 0.4;
    b.beam('gold', v(dx, h(dx), -7.85), v(dx + 0.3, h(dx + 0.3), -7.85), 0.055);
    if (i % 4 === 2) b.box('plaster', x + dx, h(dx) - 0.25, z - 7.85, 0.14, 0.4, 0.035, 0.4);
  }
  block(0, -10.5, 5, 3.7, 8);

  // The gate spans the eastern entrance, leaving the bridge approach open.
  for (const dz of [-2.9, 2.9]) {
    b.box('red', x + 15, 2.55, z + dz, 0.36, 5.1, 0.36);
    b.box('black', x + 15, 0.32, z + dz, 0.47, 0.64, 0.47);
    block(15, dz, 0.24, 0.24, 5.4);
  }
  b.box('red', x + 15, 4.2, z, 0.28, 0.25, 7);
  b.box('red', x + 15, 5, z, 0.48, 0.38, 8);
  b.box('black', x + 15, 5.27, z, 0.6, 0.2, 8.5);
  b.box('gold', x + 15.26, 4.52, z, 0.08, 0.72, 0.47);

  // Small DJ desk on a shallow platform, with two records, mixer and warm meters.
  b.box('timber', x, 0.17, z - 4.4, 8.5, 0.34, 3.5);
  b.box('trim', x, 1.12, z - 3.7, 4.3, 0.95, 1);
  b.box('black', x, 1.64, z - 3.7, 4.5, 0.14, 1.15);
  block(0, -4.4, 4.25, 1.75);
  const records: THREE.Group[] = [];
  const vinyl = new THREE.MeshStandardMaterial({ color: '#1b2730', roughness: 0.4 });
  const label = new THREE.MeshStandardMaterial({ color: '#d5b98b', roughness: 0.8 });
  for (const dx of [-1.25, 1.25]) {
    const record = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.025, 32), vinyl);
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20), label);
    center.position.y = 0.015;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.1), vinyl);
    mark.position.set(0.05, 0.025, 0);
    record.add(disc, center, mark);
    record.position.set(x + dx, 1.73, z - 3.7);
    b.group.add(record);
    records.push(record);
    b.beam('gold', v(dx + 0.42, 1.8, -4), v(dx + 0.12, 1.8, -3.65), 0.025);
  }
  for (let i = 0; i < 5; i++) {
    b.box('stone', x - 0.3 + i * 0.15, 1.73, z - 3.7, 0.025, 0.025, 0.55);
    b.box('gold', x - 0.3 + i * 0.15, 1.76, z - 3.85 + i * 0.07, 0.09, 0.05, 0.07);
    b.box('lantern', x - 0.3 + i * 0.15, 1.74, z - 4.03, 0.07, 0.02, 0.08);
  }
  for (const dx of [-3.3, 3.3]) {
    b.box('black', x + dx, 1.13, z - 3.7, 1.05, 1.6, 0.85);
    for (const yy of [0.8, 1.48]) {
      b.ball('darkStone', x + dx, yy, z - 3.24, 0.36, 0.36, 0.06);
      b.ball('black', x + dx, yy, z - 3.17, 0.16, 0.16, 0.035);
    }
  }
  const dj = detail.traveler();
  dj.group.position.set(x, 0.35, z - 4.7);
  dj.la.rotation.x = -1.05;
  dj.ra.rotation.x = -1.15;
  const headphones = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 8, 16, Math.PI), vinyl);
  headphones.position.set(0, 1.66, 0);
  dj.group.add(headphones);
  for (const dx of [-0.245, 0.245]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.18), vinyl);
    ear.position.set(dx, 1.65, 0);
    dj.group.add(ear);
  }
  b.group.add(dj.group);

  // Paper lanterns sag softly over the courtyard; no flashing stage lighting.
  for (const dz of [-5.8, 6.8]) {
    for (const dx of [-8, 8]) b.box('timber', x + dx, 2.8, z + dz, 0.16, 5.6, 0.16);
    for (let i = 0; i < 32; i++) {
      const dx = -8 + i * 0.5;
      const h = (a: number) => 5.6 - Math.cos(((a / 8) * Math.PI) / 2) * 1.15;
      b.beam('black', v(dx, h(dx), dz), v(dx + 0.5, h(dx + 0.5), dz), 0.022);
      if (i % 4 === 2) detail.lantern(x + dx, h(dx) - 0.45, z + dz);
    }
  }
  for (const [dx, dz, size, cherry] of [
    [-13, -9, 2.6, false],
    [10, -11, 2.5, false],
    [-15, 6, 2.5, true],
    [8, 12, 2.1, true],
    [-6, 15, 1.8, false],
  ] as const)
    detail.tree(x + dx, 0, z + dz, size, cherry);
  for (const dx of [-9, 9]) {
    detail.lantern(x + dx, 0, z + 4, true);
    detail.lantern(x + dx, 0, z - 7, true);
    b.box('timber', x + dx, 0.48, z + 8, 4, 0.18, 1.1);
    for (const leg of [-1.5, 1.5]) b.box('timber', x + dx + leg, 0.23, z + 8, 0.16, 0.46, 0.9);
    block(dx, 8, 2, 0.55, 1);
  }
  for (const [dx, dz, yaw] of [
    [-4, 2, 2.7],
    [4, 3, -2.8],
    [-5, 6, 2.9],
    [3, 7, -2.9],
  ]) {
    b.box('cloth', x + dx, 0.11, z + dz, 1.2, 0.2, 1.2);
    const guest = detail.traveler();
    guest.group.position.set(x + dx, 0.22, z + dz);
    guest.group.rotation.y = yaw;
    b.group.add(guest.group);
    block(dx, dz, 0.55, 0.55, 2);
  }
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    if (Math.cos(a) > 0.96) continue;
    detail.fence(x + Math.cos(a) * 20.8, 0, z + Math.sin(a) * 20.8, 3.1, -a - Math.PI / 2);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#283c42';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#c0a273';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 992, 224);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#efdbb4';
  ctx.font = '52px serif';
  ctx.fillText('月音神社 · 宵の音', 512, 105);
  ctx.font = '27px serif';
  ctx.fillText('TSUKINE  /  LOFI GATHERING', 512, 180);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const signMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.95, 0.85), signMaterial);
  sign.position.set(x, 1.1, z - 3.185);
  b.group.add(sign);
  const wayfinding = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.95), signMaterial);
  wayfinding.position.set(-69, 1.9, 3.3);
  b.group.add(wayfinding);
  b.box('timber', -69, 1.3, 3.2, 3.8, 2.2, 0.12);
  return (time: number) => {
    records.forEach((record) => {
      record.rotation.y = time * 0.7;
    });
    dj.group.rotation.z = Math.sin(time * 1.8) * 0.025;
    dj.ra.rotation.x = -1.15 + Math.sin(time * 1.8) * 0.1;
  };
}
