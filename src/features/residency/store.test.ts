import { describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { ResidencyStore } from './store';
import { normalizeUsername, usernameError, reservedUsernames } from './username';

const session = (id = 'user-a') =>
  ({ user: { id, email_confirmed_at: '2026-09-05', is_anonymous: false } }) as Session;
const resident = { user_id: 'user-a', username: 'taishi', reserved_at: '2026-09-05' };
function fixture(initial: Session | null = session()) {
  let authChange: (event: string, session: Session | null) => void = () => {};
  const read = vi.fn().mockResolvedValue({ data: null, error: null });
  const insert = vi.fn().mockResolvedValue({ data: resident, error: null });
  const send = vi.fn().mockResolvedValue({ error: null });
  const availability = vi.fn().mockResolvedValue({ data: true, error: null });
  const client = {
    rpc: availability,
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        authChange = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: initial }, error: null }),
      signInWithOAuth: send,
      signOut: vi.fn(async () => {
        authChange('SIGNED_OUT', null);
        return { error: null };
      }),
    },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: read }) }),
      insert: (value: unknown) => ({ select: () => ({ single: () => insert(value) }) }),
    })),
  };
  const store = new ResidencyStore(client as unknown as SupabaseClient);
  return {
    store,
    availability,
    read,
    insert,
    send,
    client,
    authChange: (s: Session | null) => authChange('SIGNED_IN', s),
  };
}
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('username rules', () => {
  it('normalizes names and enforces the complete namespace rules', () => {
    expect(normalizeUsername(' TaIshi ')).toBe('taishi');
    for (const name of ['ab', 'a'.repeat(21), 'taishi-name', '湯影', 'ABC', ...reservedUsernames])
      expect(usernameError(name)).not.toBeNull();
    for (const name of ['abc', 'a'.repeat(20), 'taishi_123'])
      expect(usernameError(name)).toBeNull();
  });
});

describe('residency state and recovery', () => {
  it('does not treat profile failures as an unreserved account', async () => {
    const f = fixture();
    f.read.mockResolvedValue({ data: null, error: { code: 'network' } });
    await f.store.retry();
    expect(f.store.getSnapshot().status).toBe('error');
    f.read.mockResolvedValue({ data: null, error: null });
    await f.store.retry();
    expect(f.store.getSnapshot().status).toBe('unreserved');
  });
  it('only shows a card after the DB returns the confirmed reservation', async () => {
    const f = fixture();
    await f.store.retry();
    await f.store.reserve(' Taishi ');
    expect(f.insert).toHaveBeenCalledWith({ user_id: 'user-a', username: 'taishi' });
    expect(f.store.getSnapshot().resident).toEqual(resident);
  });
  it.each(['lost-response', '23505'])(
    'recovers a committed reservation after %s',
    async (failure) => {
      const f = fixture();
      await f.store.retry();
      if (failure === 'lost-response') f.insert.mockRejectedValue(new Error('network'));
      else f.insert.mockResolvedValue({ data: null, error: { code: failure } });
      f.read.mockResolvedValue({ data: resident, error: null });
      await f.store.reserve('taishi');
      expect(f.store.getSnapshot().resident).toEqual(resident);
    },
  );
  it('reports a competing username without creating a resident card', async () => {
    const f = fixture();
    await f.store.retry();
    f.insert.mockResolvedValue({ data: null, error: { code: '23505' } });
    await f.store.reserve('taishi');
    expect(f.store.getSnapshot().status).toBe('unreserved');
    expect(f.store.getSnapshot().error).toContain('already taken');
  });
  it('blocks duplicate submissions while an INSERT is pending', async () => {
    const f = fixture();
    await f.store.retry();
    let resolve!: (value: unknown) => void;
    f.insert.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const first = f.store.reserve('taishi');
    await f.store.reserve('another');
    expect(f.insert).toHaveBeenCalledTimes(1);
    resolve({ data: resident, error: null });
    await first;
  });
  it('discards a late reservation response after sign-out in another tab', async () => {
    const f = fixture();
    const stop = f.store.start();
    await settle();
    let resolve!: (value: unknown) => void;
    f.insert.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = f.store.reserve('taishi');
    f.authChange(null);
    resolve({ data: resident, error: null });
    await pending;
    expect(f.store.getSnapshot().status).toBe('guest');
    expect(f.store.getSnapshot().resident).toBeNull();
    stop();
  });
  it('discards a late profile response after switching accounts', async () => {
    const f = fixture();
    const stop = f.store.start();
    await settle();
    let resolve!: (value: unknown) => void;
    f.read.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    f.authChange(session());
    f.authChange(session('user-b'));
    await settle();
    resolve({ data: resident, error: null });
    await settle();
    expect(f.store.getSnapshot().resident).toBeNull();
    expect(f.store.getSnapshot().status).toBe('unreserved');
    stop();
  });
  it('does not treat an OAuth redirect as an authenticated session', async () => {
    const f = fixture(null);
    await f.store.retry();
    expect(await f.store.signInWithGoogle('https://anime.yukagecho.workers.dev/')).toBe(true);
    expect(f.send).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://anime.yukagecho.workers.dev/' },
    });
    expect(f.store.getSnapshot().status).toBe('guest');
  });
  it('shows a retryable error if Google OAuth cannot start', async () => {
    const f = fixture(null);
    await f.store.retry();
    f.send.mockResolvedValue({ error: { code: 'provider_disabled' } });
    expect(await f.store.signInWithGoogle('https://anime.yukagecho.workers.dev/')).toBe(false);
    expect(f.store.getSnapshot()).toMatchObject({ status: 'guest', busy: false });
    expect(f.store.getSnapshot().error).toContain('Google sign-in could not start');
  });
  it('checks only normalized names and reports taken names', async () => {
    const f = fixture(null);
    await f.store.retry();
    expect(await f.store.checkAvailability(' Taishi ')).toBe(true);
    expect(f.availability).toHaveBeenCalledWith('username_available', { candidate: 'taishi' });
    f.availability.mockResolvedValue({ data: false, error: null });
    expect(await f.store.checkAvailability('taken')).toBe(false);
    expect(f.store.getSnapshot().error).toContain('already taken');
  });
  it('never treats an availability error as a free name', async () => {
    const f = fixture(null);
    await f.store.retry();
    f.availability.mockResolvedValue({ data: null, error: { code: 'network' } });
    expect(await f.store.checkAvailability('taishi')).toBe(false);
    expect(f.store.getSnapshot().error).toContain('could not reach');
  });
  it('keeps guest exploration available without configuration', () => {
    expect(new ResidencyStore(null).getSnapshot().status).toBe('unavailable');
  });
});
