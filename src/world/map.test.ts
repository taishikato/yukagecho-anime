import { describe, expect, it } from 'vitest';
import {
  canWalk,
  canal,
  walkways,
  walkwayPoint,
  nearestPlace,
  places,
  surfaceHeight,
  interactionAt,
  registrationSign,
  spawn,
} from './map';

describe('walkable main island', () => {
  it('keeps every discovery point accessible at its district height', () => {
    for (const place of places) {
      expect(surfaceHeight(place.x, place.z)).toBeCloseTo(place.y + 0.15);
      expect(nearestPlace(place.x, place.z).id).toBe(place.id);
    }
  });
  it('has continuous bridges and stairs, including both joins to land', () => {
    for (const w of walkways) {
      const dx = w.bx - w.ax,
        dz = w.bz - w.az,
        length = Math.hypot(dx, dz);
      let previous = surfaceHeight(w.ax - (dx / length) * 0.1, w.az - (dz / length) * 0.1)!;
      for (let i = 0; i <= 1000; i++) {
        const p = walkwayPoint(w, i / 1000);
        const height = surfaceHeight(p.x, p.z);
        expect(height).toBeCloseTo(p.y + 0.15);
        expect(Math.abs(height! - previous)).toBeLessThan(0.05);
        expect(canWalk(p.x, p.z, [], previous)).toBe(true);
        previous = height!;
      }
      expect(surfaceHeight(w.bx + (dx / length) * 0.1, w.bz + (dz / length) * 0.1)).toBeCloseTo(
        w.by + 0.15,
      );
    }
  });
  it('allows crossing the canal only at bridges and keeps both banks walkable', () => {
    expect(surfaceHeight(canal.x, -20)).toBeNull();
    expect(surfaceHeight(canal.x, -5)).toBeNull();
    for (const w of walkways.filter((w) => w.arch > 0)) {
      expect(surfaceHeight(canal.x, w.az)).toBeCloseTo(1.35);
      expect(surfaceHeight(canal.x, w.az + w.width / 2 + 0.1)).toBeNull();
    }
    for (let z = -33; z <= 9; z++) {
      expect(surfaceHeight(17, z)).not.toBeNull();
      expect(surfaceHeight(27, z)).not.toBeNull();
    }
  });
  it('blocks sheer terrace walls in both directions while allowing the stairs', () => {
    expect(canWalk(13.9, -30, [], 0.15)).toBe(false);
    expect(canWalk(14.1, -30, [], 6.15)).toBe(false);
    expect(canWalk(0, -10.1, [], surfaceHeight(0, -10)!)).toBe(true);
  });
  it('connects upper town, midway balconies and lower market without teleporting', () => {
    expect(surfaceHeight(0, 52)).toBeCloseTo(0.15);
    expect(surfaceHeight(-64, 74)).toBeCloseTo(-8.85);
    expect(surfaceHeight(0, 104)).toBeCloseTo(-17.85);
    expect(canWalk(0, 81, [], 0.15)).toBe(false);
    expect(surfaceHeight(0, 80, -17.85)).toBeNull();
    for (const side of [-1, 1]) {
      expect(surfaceHeight(side * 62, 81)).toBeCloseTo(-8.85);
      expect(surfaceHeight(side * 37, 99)).toBeCloseTo(-17.85);
    }
  });
  it('resolves building collisions and interactions at the traveler height', () => {
    const upperBuilding = { x: 0, z: 104, halfX: 2, halfZ: 2, baseY: 0, height: 10 };
    expect(canWalk(0, 104, [upperBuilding], -17.85)).toBe(true);
    expect(canWalk(0, 104, [{ ...upperBuilding, baseY: -18 }], -17.85)).toBe(false);
    expect(interactionAt(0, 104, 0)).toBeNull();
    expect(interactionAt(0, 104, -17.85)?.kind).toBe('discovery');
  });
  it('prevents walking into buildings or off the floating island', () => {
    const obstacles = [{ x: 7, z: 5, halfX: 2, halfZ: 2 }];
    expect(canWalk(7, 5, obstacles)).toBe(false);
    expect(canWalk(4.8, 5, obstacles)).toBe(false);
    expect(canWalk(0, 5, obstacles)).toBe(true);
    expect(canWalk(80, 80, obstacles)).toBe(false);
    expect(surfaceHeight(77, 0)).toBeNull();
    expect(surfaceHeight(60, -60)).toBeNull();
  });
});

describe('registration interaction', () => {
  it('prioritizes the arrival sign and preserves the original discovery identities', () => {
    expect(places.slice(0, 7).map((p) => p.id)).toEqual([
      'ground',
      'ground-bath',
      'ascent',
      'town',
      'onsen',
      'shrine',
      'inn',
    ]);
    expect(interactionAt(registrationSign.x, registrationSign.z)?.kind).toBe('registration');
    expect(interactionAt(spawn.x, spawn.z)?.kind).toBe('registration');
    expect(interactionAt(0, 37)?.kind).toBe('discovery');
    expect(interactionAt(100, 100)).toBeNull();
  });
});
