import { describe, expect, it } from 'vitest';
import { canWalk, connections, islands, nearestPlace, places, surfaceHeight } from './map';

describe('walkable sky village', () => {
  it('keeps every discovery point accessible at its island height', () => {
    for (const place of places) {
      expect(surfaceHeight(place.x, place.z)).toBeCloseTo(place.y + 0.15);
      expect(nearestPlace(place.x, place.z).id).toBe(place.id);
    }
  });
  it('has continuous bridges without gaps or steps at island joins', () => {
    for (const [ai, bi] of connections) {
      const a = islands[ai],
        b = islands[bi];
      let previous = surfaceHeight(a.x, a.z)!;
      for (let i = 1; i <= 1000; i++) {
        const t = i / 1000,
          height = surfaceHeight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        expect(height).not.toBeNull();
        expect(Math.abs(height! - previous)).toBeLessThan(0.05);
        previous = height!;
      }
    }
  });
  it('prevents walking into buildings or off the floating islands', () => {
    const obstacles = [{ x: 7, z: 5, halfX: 2, halfZ: 2 }];
    expect(canWalk(7, 5, obstacles)).toBe(false);
    expect(canWalk(4.8, 5, obstacles)).toBe(false);
    expect(canWalk(0, 5, obstacles)).toBe(true);
    expect(canWalk(80, 80, obstacles)).toBe(false);
    expect(surfaceHeight(19, 19)).toBeNull();
  });
});
