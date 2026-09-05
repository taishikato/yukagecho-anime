import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearPendingUsername, readPendingUsername, savePendingUsername } from './pending';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    setItem: (key: string, value: string) => values.set(key, value),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
  });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('preserves a valid name through OAuth and consumes it explicitly', () => {
  savePendingUsername('taishi');
  expect(readPendingUsername()).toBe('taishi');
  clearPendingUsername();
  expect(readPendingUsername()).toBeNull();
});
it('does not auto-claim an expired or invalid name', () => {
  savePendingUsername('taishi');
  vi.advanceTimersByTime(31 * 60 * 1000);
  expect(readPendingUsername()).toBeNull();
  savePendingUsername('admin');
  expect(readPendingUsername()).toBeNull();
});
it('fails closed when browser storage is blocked', () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  });
  expect(readPendingUsername()).toBeNull();
  expect(() => savePendingUsername('taishi')).toThrow();
  expect(() => clearPendingUsername()).not.toThrow();
});
