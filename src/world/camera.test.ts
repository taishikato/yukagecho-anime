import { Box3, PerspectiveCamera, Ray, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { districtCameraDistance, followOffset } from './camera';

describe('automatic camera framing', () => {
  it('eases across the canal boundary and limits district zoom to 25 percent', () => {
    expect(districtCameraDistance(32, 13.99, 0)).toBe(32);
    expect(districtCameraDistance(32, 14.01, 0)).toBeCloseTo(32, 3);
    expect(districtCameraDistance(32, 22, 0)).toBe(24);
    expect(districtCameraDistance(10, 22, 0)).toBe(8);
  });
  const focus = new Vector3(0, 1.1, 0);
  const wall = new Box3(new Vector3(-5, 0, 2), new Vector3(5, 12, 8));
  it('keeps a readable distance when a nearby building blocks the orbit', () => {
    const offset = followOffset(focus, 32, 0, 0.24, [wall]);
    expect(offset.length()).toBeGreaterThanOrEqual(8);
    const hit = new Ray(focus, offset.clone().normalize()).intersectBox(wall, new Vector3());
    expect(hit === null || hit.distanceTo(focus) > offset.length()).toBe(true);
  });
  it('keeps the whole traveler in frame on desktop and portrait screens near a wall', () => {
    for (const aspect of [1.5, 390 / 844]) {
      const camera = new PerspectiveCamera(55, aspect, 0.2, 650);
      camera.position.copy(focus).add(followOffset(focus, 10, 0, 0.24, [wall]));
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      for (const x of [-0.45, 0.45])
        for (const y of [0, 1.95]) {
          const projected = new Vector3(x, y, 0).project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(0.85);
          expect(Math.abs(projected.y)).toBeLessThan(0.85);
          expect(projected.z).toBeLessThan(1);
        }
    }
  });
  it('preserves manual orbit distance and angle without an obstruction', () => {
    const offset = followOffset(focus, 32, 0.8, 0.4, []);
    expect(offset.length()).toBeCloseTo(32);
    expect(Math.atan2(offset.x, offset.z)).toBeCloseTo(0.8);
    expect(Math.asin(offset.y / 32)).toBeCloseTo(0.4);
  });
});
