export interface Island {
  id: string;
  x: number;
  z: number;
  y: number;
  radius: number;
  minZ?: number;
}
export interface Place {
  id: string;
  name: string;
  english: string;
  description: string;
  story: string;
  x: number;
  z: number;
  y: number;
  symbol: string;
}

// One continuous landmass. Districts are neighborhoods, not separate islands.
export const islands: Island[] = [
  { id: 'town', x: 0, z: 0, y: 0, radius: 78 },
  { id: 'lower-town', x: 0, z: 100, y: -18, radius: 43, minZ: 81 },
  { id: 'west-landing', x: -64, z: 74, y: -9, radius: 10 },
  { id: 'east-landing', x: 64, z: 74, y: -9, radius: 10 },
];
export const lowerTown = islands[1];
export const spawn = { x: 0, y: 0.15, z: 43 };
export const registrationSign = { x: -2.5, y: 0, z: 43, radius: 2.8 };
export const terrace = { x: 0, z: -33, halfX: 14, halfZ: 14, y: 6 };
export const canal = { x: 22, z: -12, width: 5.2, length: 44 };
export interface Walkway {
  id: string;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  ay: number;
  by: number;
  width: number;
  arch: number;
  kind?: 'slope';
}
export const walkways: Walkway[] = [
  ...[-1, 1].flatMap((side): Walkway[] => [
    {
      id: `${side < 0 ? 'west' : 'east'}-upper-slope`,
      ax: side * 52,
      az: 52,
      bx: side * 64,
      bz: 66,
      ay: 0,
      by: -9,
      width: 6,
      arch: 0,
      kind: 'slope',
    },
    {
      id: `${side < 0 ? 'west' : 'east'}-lower-slope`,
      ax: side * 62,
      az: 81,
      bx: side * 37,
      bz: 99,
      ay: -9,
      by: -18,
      width: 6,
      arch: 0,
      kind: 'slope',
    },
  ]),
  { id: 'ryokan-stairs', ax: 0, az: -5, bx: 0, bz: -19, ay: 0, by: 6, width: 6, arch: 0 },
  ...[-27, -12, 4].map((z, index) => ({
    id: `canal-bridge-${index}`,
    ax: 17.5,
    az: z,
    bx: 26.5,
    bz: z,
    ay: 0,
    by: 0,
    width: 3,
    arch: 1.2,
  })),
];
export function walkwayPoint(w: Walkway, t: number) {
  return {
    x: w.ax + (w.bx - w.ax) * t,
    z: w.az + (w.bz - w.az) * t,
    y: w.ay + (w.by - w.ay) * t + Math.sin(Math.PI * t) * w.arch,
  };
}
function walkwayHeight(w: Walkway, x: number, z: number) {
  const dx = w.bx - w.ax,
    dz = w.bz - w.az;
  const length = Math.hypot(dx, dz);
  const t = ((x - w.ax) * dx + (z - w.az) * dz) / (length * length);
  const distance = Math.abs((x - w.ax) * dz - (z - w.az) * dx) / length;
  return t >= 0 && t <= 1 && distance <= w.width / 2 - 0.25 ? walkwayPoint(w, t).y + 0.15 : null;
}
export const places: Place[] = [
  {
    id: 'ground',
    name: '湯あかり表参道',
    english: 'Yuakari Promenade',
    symbol: '街',
    x: 0,
    z: 37,
    y: 0,
    description: 'A whole town above the clouds. Make yourself at home.',
    story:
      'Lanterns lead from the arrival square into the heart of Yukagecho. Timber inns crowd the slopes beneath Bounro Ryokan. Follow the broad avenue north, or head south to the signed east and west slopes. They descend through a midway terrace into the lantern-lit lower town.',
  },
  {
    id: 'ground-bath',
    name: '桜泉の湯',
    english: 'Sakura Springs',
    symbol: '泉',
    x: 28,
    z: 30,
    y: 0,
    description: 'Warm water beneath a canopy of cherry blossoms.',
    story:
      'Small open-air baths line the garden path. Steam drifts between the cherry trees and the eaves of the teahouses. The path continues north to the larger baths overlooking the cloud sea.',
  },
  {
    id: 'ascent',
    name: '雲見の散歩道',
    english: 'Cloudsea Walk',
    symbol: '雲',
    x: -39,
    z: 26,
    y: 0,
    description: 'One side is a town. The other is an endless sky.',
    story:
      'Stone lanterns trace the western rim of the island. Look back to see the roofs of an entire town rising toward the great inn. Continue north to the quiet shrine, or return east to the lively promenade.',
  },
  {
    id: 'town',
    name: '灯籠運河',
    english: 'Lantern Canal',
    symbol: '灯',
    x: 17,
    z: 4,
    y: 0,
    description: 'Red bridges and a thousand windows above the water.',
    story:
      'Tall timber inns lean over the narrow canal. Lanterns hang between their balconies, and high bridges join the upper rooms. Walk along either bank and cross the three low red bridges to explore both sides.',
  },
  {
    id: 'onsen',
    name: '雲渡りの湯',
    english: 'Kumowatari Onsen',
    symbol: '湯',
    x: 42,
    z: 13,
    y: 0,
    description: 'Beyond the steam, the island gives way to clouds.',
    story:
      'The largest outdoor spring opens toward the eastern horizon. Blue water catches the last light of the day. A wooden pavilion shelters the bath, while the canal district glows just beyond the garden.',
  },
  {
    id: 'shrine',
    name: '風待ち神社',
    english: 'Kazemachi Shrine',
    symbol: '祈',
    x: -35,
    z: -18,
    y: 0,
    description: 'A quiet corner, where the wind carries your wishes.',
    story:
      'Beyond the busy inns, an old red gate stands among the pines. Travelers leave their wishes here before taking the long path around the island. From the shrine courtyard, the great ryokan rises above the tiled roofs.',
  },
  {
    id: 'inn',
    name: '望雲楼',
    english: 'Bounro Ryokan',
    symbol: '宿',
    x: 0,
    z: -23,
    y: 6,
    description: 'The heart of Yukagecho, rising above a sea of roofs.',
    story:
      'The grand inn crowns the northern terrace. Climb the broad red stairway to its courtyard and look south across the entire island: the promenade, the canal, the baths, and the cloud sea beyond. Its rooms are scenery for now; the courtyard is yours to explore.',
  },
  {
    id: 'switchback',
    name: '九折坂の踊り場',
    english: 'Switchback Terrace',
    symbol: '坂',
    x: -64,
    z: 74,
    y: -9,
    description: 'The rooftops above. The night market below.',
    story:
      'Halfway down the western cliff road, the town opens in two directions. The great inn rises above the upper streets, while lanterns lead downhill into the lower quarter. Follow the stone slope south, then east, to the market.',
  },
  {
    id: 'lower-market',
    name: '宵待ち横丁',
    english: 'Yoimachi Night Market',
    symbol: '宵',
    x: 0,
    z: 104,
    y: -18,
    description: 'A second town, tucked beneath the first.',
    story:
      'Eighteen meters below the promenade, kitchens, tea shops and narrow inns crowd the lantern-lit street. Look up between the roofs to see the island rising above you. The east and west slopes both climb back to the upper town, making a full walking loop.',
  },
];

export type InteractionTarget = { kind: 'registration' } | { kind: 'discovery'; place: Place };
export function interactionAt(x: number, z: number, y?: number): InteractionTarget | null {
  if (
    Math.hypot(
      x - registrationSign.x,
      z - registrationSign.z,
      y === undefined ? 0 : y - registrationSign.y,
    ) < registrationSign.radius
  )
    return { kind: 'registration' };
  const place = nearestPlace(x, z, y);
  return Math.hypot(x - place.x, z - place.z, y === undefined ? 0 : y - place.y) < 4.3
    ? { kind: 'discovery', place }
    : null;
}

/** Rendering and traversal use the same bridge and terrace dimensions. */
export function surfaceHeight(x: number, z: number, fromY?: number): number | null {
  // Bridges and slopes own their corridor, including the joins to each terrace.
  for (const w of walkways) {
    const y = walkwayHeight(w, x, z);
    if (y !== null) return y;
  }
  if (
    Math.abs(x - canal.x) < canal.width / 2 + 0.3 &&
    Math.abs(z - canal.z) < canal.length / 2 + 0.3
  )
    return null;
  if (Math.abs(x - terrace.x) <= terrace.halfX && Math.abs(z - terrace.z) <= terrace.halfZ)
    return terrace.y + 0.15;
  const heights = islands
    .filter(
      (i) =>
        (i.minZ === undefined || z >= i.minZ) &&
        Math.hypot(x - i.x, z - i.z) < i.radius * 0.965 - 0.65,
    )
    .map((i) => i.y + 0.15);
  if (!heights.length) return null;
  return fromY === undefined
    ? Math.max(...heights)
    : heights.sort((a, b) => Math.abs(a - fromY) - Math.abs(b - fromY))[0];
}
export interface Obstacle {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  baseY?: number;
  height?: number;
}
export function canWalk(x: number, z: number, obstacles: Obstacle[], fromY?: number) {
  const y = surfaceHeight(x, z, fromY);
  return (
    y !== null &&
    (fromY === undefined || Math.abs(y - fromY) <= 0.5) &&
    !obstacles.some(
      (o) =>
        y + 1.8 > (o.baseY ?? 0) &&
        y < (o.baseY ?? 0) + (o.height ?? 3) &&
        Math.abs(x - o.x) < o.halfX + 0.32 &&
        Math.abs(z - o.z) < o.halfZ + 0.32,
    )
  );
}
export function nearestPlace(x: number, z: number, y?: number) {
  const distance = (p: Place) => Math.hypot(p.x - x, p.z - z, y === undefined ? 0 : p.y - y);
  return [...places].sort((a, b) => distance(a) - distance(b))[0];
}
