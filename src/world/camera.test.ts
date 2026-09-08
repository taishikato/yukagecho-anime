import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { followOffset } from './camera';

describe('manual camera framing', () => {
  const focus = new Vector3(0, 1.1, 0);
  it('keeps the whole traveler in frame on desktop and portrait screens', () => {
    for (const aspect of [1.5, 390 / 844]) {
      const camera = new PerspectiveCamera(55, aspect, 0.2, 650);
      camera.position.copy(focus).add(followOffset(10, 0, 0.24));
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
  it('preserves manual orbit distance and angle', () => {
    const offset = followOffset(32, 0.8, 0.4);
    expect(offset.length()).toBeCloseTo(32);
    expect(Math.atan2(offset.x, offset.z)).toBeCloseTo(0.8);
    expect(Math.asin(offset.y / 32)).toBeCloseTo(0.4);
  });
});
