export interface Island {
  id: string;
  x: number;
  z: number;
  y: number;
  radius: number;
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
];
export const connections = [
  [0, 1],
  [0, 2],
  [0, 3],
] as const;
export const places: Place[] = [
  {
    id: 'town',
    name: '湯あかり通り',
    english: 'YUAKARI STREET',
    description: '軒先の灯りが、旅人を迎える。',
    story:
      '雲が茜に染まる頃、一つ、また一つと提灯が灯る。遠くで鳴る風鈴と、木の下駄の音。ここには、急ぐ理由がありません。',
    x: 0,
    z: 9,
    y: 0,
    symbol: '灯',
  },
  {
    id: 'onsen',
    name: '雲渡りの湯',
    english: 'KUMOWATARI ONSEN',
    description: '湯けむりの向こうに、まだ知らない景色。',
    story:
      '千年ものあいだ、雲の上で湧き続ける青い湯。湯船の縁に腰かければ、空とお湯の境目が消えてゆく。深呼吸をひとつ、どうぞ。',
    x: 32,
    z: 12,
    y: 1,
    symbol: '湯',
  },
  {
    id: 'shrine',
    name: '風待ち神社',
    english: 'KAZEMACHI SHRINE',
    description: '願いごとは、風にあずけて。',
    story:
      '空を渡る旅人が、無事を祈った小さな社。結ばれた願いは、風に乗ってどこへ行くのでしょう。桜の木だけが知っているのかもしれません。',
    x: -30,
    z: -14,
    y: 2,
    symbol: '祈',
  },
  {
    id: 'inn',
    name: '望雲楼',
    english: 'BOUNRO RYOKAN',
    description: 'いちばん空に近い、旅の宿。',
    story:
      '幾重にも重なる屋根は、空へ続く階段のよう。今夜のお部屋からは、足もとを流れる雲海が見えます。旅の続きは、また明日。',
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
