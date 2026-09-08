import { Box3, Ray, Vector3 } from 'three';

export const minimumFollowDistance = 8;

/** Ease into the narrower canal framing without overriding the user's zoom. */
export function districtCameraDistance(distance: number, x: number, z: number) {
  const edgeDistance = Math.min(x - 14, 30 - x, z + 35, 12 - z);
  const t = Math.max(0, Math.min(1, edgeDistance / 5));
  const blend = t * t * (3 - 2 * t);
  return Math.max(minimumFollowDistance, distance * (1 - blend * 0.25));
}

/** Keep the traveler readable; raise the orbit when a wall would force a close-up. */
export function followOffset(
  focus: Vector3,
  distance: number,
  yaw: number,
  pitch: number,
  walls: Box3[],
) {
  const desiredDistance = Math.max(minimumFollowDistance, distance);
  const ray = new Ray();
  const hit = new Vector3();
  const direction = new Vector3();
  for (let step = 0; step <= 24; step++) {
    const elevation = pitch + ((Math.PI / 2 - pitch) * step) / 24;
    direction.set(
      Math.sin(yaw) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(yaw) * Math.cos(elevation),
    );
    ray.set(focus, direction);
    let clearDistance = desiredDistance;
    for (const wall of walls) {
      if (ray.intersectBox(wall, hit))
        clearDistance = Math.min(clearDistance, hit.distanceTo(focus) - 0.5);
    }
    if (clearDistance >= minimumFollowDistance)
      return direction.clone().multiplyScalar(clearDistance);
  }
  // The player cannot occupy a building; a vertical view clears the surrounding facades.
  return new Vector3(0, desiredDistance, 0);
}
