export const reservedUsernames = [
  'admin',
  'administrator',
  'support',
  'system',
  'yukagecho',
  'moderator',
  'staff',
  'official',
];
export const normalizeUsername = (value: string) => value.trim().toLowerCase();
export function usernameError(value: string): string | null {
  if (!/^[a-z0-9_]{3,20}$/.test(value)) return 'Use 3-20 letters, numbers, or underscores.';
  if (reservedUsernames.includes(value))
    return 'This username is reserved for the town. Try another.';
  return null;
}
