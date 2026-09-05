import { usernameError } from './username';

const key = 'yukagecho.pending-username';
const lifetime = 30 * 60 * 1000;

export function savePendingUsername(username: string) {
  // Abort OAuth if storage is unavailable: never lose a user's chosen name silently.
  sessionStorage.setItem(key, JSON.stringify({ username, createdAt: Date.now() }));
}
export function readPendingUsername(): string | null {
  try {
    const pending = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      !pending ||
      typeof pending.username !== 'string' ||
      usernameError(pending.username) ||
      typeof pending.createdAt !== 'number' ||
      Date.now() < pending.createdAt ||
      Date.now() - pending.createdAt > lifetime
    )
      return null;
    return pending.username;
  } catch {
    return null;
  }
}
export function clearPendingUsername() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* No saved intent is available. */
  }
}
