export interface Island {
  id: string;
  x: number;
  z: number;
  y: number;
  radius: number;
  grounded?: boolean;
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
export const islands: Island[] = [
  { id: 'town', x: 0, z: 0, y: 0, radius: 18 },
  { id: 'onsen', x: 35, z: 7, y: 1, radius: 11 },
  { id: 'shrine', x: -33, z: -18, y: 2, radius: 10 },
  { id: 'inn', x: 2, z: -42, y: 4, radius: 14 },
  { id: 'ground', x: 0, z: 140, y: -28, radius: 32, grounded: true },
  { id: 'ascent', x: 0, z: 70, y: -14, radius: 10 },
];
export const spawn = { x: 0, y: -27.85, z: 148 };
export const registrationSign = { x: -2.5, y: -28, z: 148, radius: 2.8 };
export type InteractionTarget = { kind: 'registration' } | { kind: 'discovery'; place: Place };

export function interactionAt(x: number, z: number): InteractionTarget | null {
  if (Math.hypot(x - registrationSign.x, z - registrationSign.z) < registrationSign.radius)
    return { kind: 'registration' };
  const place = nearestPlace(x, z);
  return Math.hypot(x - place.x, z - place.z) < 4.3 ? { kind: 'discovery', place } : null;
}
export const connections = [
  [0, 1],
  [0, 2],
  [0, 3],
  [4, 5],
  [5, 0],
] as const;
export const places: Place[] = [
  {
    id: 'ground',
    name: '麓の温泉街',
    english: 'Foothill Onsen Town',
    description: 'Every skyward journey begins on a lantern-lit street.',
    story:
      'Steam rises between timber inns and cherry trees at the foot of the mountain. Beyond the rooftops, red bridges climb into the clouds. Follow the main street north to begin the ascent.',
    x: 0,
    z: 146,
    y: -28,
    symbol: '街',
  },
  {
    id: 'ground-bath',
    name: '桜泉の湯',
    english: 'Sakura Springs',
    description: 'Warm water, falling petals, and the sky overhead.',
    story:
      'The oldest spring in the valley gathers beneath the cherry blossoms. Look up from the water: the lights of Yukagecho are already glowing in the sky. The red stairway leaves from the north end of town.',
    x: 12,
    z: 136,
    y: -28,
    symbol: '泉',
  },
  {
    id: 'ascent',
    name: '雲見の辻',
    english: 'Cloudview Terrace',
    description: 'The town below. A whole new world above.',
    story:
      'Halfway between earth and sky, travelers pause at this little teahouse. Follow the red bridge north to reach Yuakari Street, or turn south to return to the foothill town.',
    x: 0,
    z: 70,
    y: -14,
    symbol: '雲',
  },
  {
    id: 'town',
    name: '湯あかり通り',
    english: 'Yuakari Street',
    description: 'Warm lanterns welcome the wandering traveler.',
    story:
      'As the clouds turn rose-gold, paper lanterns glow one by one. Wind chimes ring in the distance, mingling with the soft clack of wooden sandals. Here, there is no reason to hurry.',
    x: 0,
    z: 9,
    y: 0,
    symbol: '灯',
  },
  {
    id: 'onsen',
    name: '雲渡りの湯',
    english: 'Kumowatari Onsen',
    description: 'Beyond the steam, a new view awaits.',
    story:
      'For a thousand years, these blue springs have bubbled above the clouds. At the edge of the bath, the water seems to melt into the sky. Stay a moment. Take a breath.',
    x: 32,
    z: 12,
    y: 1,
    symbol: '湯',
  },
  {
    id: 'shrine',
    name: '風待ち神社',
    english: 'Kazemachi Shrine',
    description: 'Let the wind carry your wishes.',
    story:
      'A small shrine where skyward travelers once prayed for safe passage. Where do their wishes go when the wind carries them away? Perhaps only the cherry tree knows.',
    x: -30,
    z: -14,
    y: 2,
    symbol: '祈',
  },
  {
    id: 'inn',
    name: '望雲楼',
    english: 'Bounro Ryokan',
    description: 'An inn a little closer to the sky.',
    story:
      'Layer upon layer of tiled roofs rise like steps toward the sky. From the rooms of this traditional inn, a sea of clouds drifts far below. The rest of the journey can wait until tomorrow.',
    x: 2,
    z: -36,
    y: 4,
    symbol: '宿',
  },
];

export function bridgeAt(a: Island, b: Island, t: number) {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    y: a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * 1.6,
  };
}

/** Continuous walkable surface, including height along arched bridges. */
export function surfaceHeight(x: number, z: number): number | null {
  for (const [ai, bi] of connections) {
    const a = islands[ai],
      b = islands[bi];
    const dx = b.x - a.x,
      dz = b.z - a.z,
      len2 = dx * dx + dz * dz;
    const t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
    const start = (a.radius - 2) / Math.sqrt(len2);
    const end = 1 - (b.radius - 2) / Math.sqrt(len2);
    if (t >= start && t <= end && Math.abs((x - a.x) * dz - (z - a.z) * dx) / Math.sqrt(len2) < 2) {
      const u = (t - start) / (end - start);
      return a.y + (b.y - a.y) * u + Math.sin(Math.PI * u) * 1.6 + 0.15;
    }
  }
  for (const island of islands) {
    if (Math.hypot(x - island.x, z - island.z) < island.radius - 0.65) return island.y + 0.15;
  }
  return null;
}

export interface Obstacle {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
}
export function canWalk(x: number, z: number, obstacles: Obstacle[]) {
  return (
    surfaceHeight(x, z) !== null &&
    !obstacles.some((o) => Math.abs(x - o.x) < o.halfX + 0.32 && Math.abs(z - o.z) < o.halfZ + 0.32)
  );
}
export function nearestPlace(x: number, z: number) {
  return [...places].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
}
