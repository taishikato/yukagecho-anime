import { Vector3 } from 'three';

export const minimumFollowDistance = 8;

/** Keep the user's orbit distance and angles while following the traveler. */
export function followOffset(distance: number, yaw: number, pitch: number) {
  return new Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ).multiplyScalar(Math.max(minimumFollowDistance, distance));
}
