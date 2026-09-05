import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { normalizeUsername, usernameError } from './username';

export interface Resident {
  user_id: string;
  username: string;
  reserved_at: string;
}
export interface ResidencyState {
  userId: string | null;
  status: 'unavailable' | 'loading' | 'guest' | 'unreserved' | 'resident' | 'error';
  resident: Resident | null;
  busy: boolean;
  error: string;
}
const connectionError = 'We could not reach the registration desk. Please try again.';

/** Owns session transitions and ignores responses belonging to an earlier identity. */
export class ResidencyStore {
  private state: ResidencyState;
  private listeners = new Set<() => void>();
  private session: Session | null = null;
  private generation = 0;
  private stopAuth?: () => void;
  constructor(private client: SupabaseClient | null) {
    this.state = {
      userId: null,
      status: client ? 'loading' : 'unavailable',
      resident: null,
      busy: false,
      error: '',
    };
  }
  getSnapshot = () => this.state;
  clearError = () => {
    if (this.state.error) this.update({ error: '' });
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<ResidencyState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  start = () => {
    if (!this.client) return () => {};
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && this.session?.user.id === session?.user.id) {
        this.session = session;
        return;
      }
      void this.acceptSession(session);
    });
    this.stopAuth = () => data.subscription.unsubscribe();
    void this.retry();
    return () => {
      this.generation++;
      this.stopAuth?.();
    };
  };
  retry = async () => {
    if (!this.client) return;
    const generation = ++this.generation;
    this.update({ status: 'loading', resident: null, error: '', busy: false });
    try {
      const { data, error } = await this.client.auth.getSession();
      if (generation !== this.generation) return;
      if (error) throw error;
      await this.acceptSession(data.session);
    } catch {
      if (generation === this.generation) this.update({ status: 'error', error: connectionError });
    }
  };
  private async readResident(userId: string) {
    const { data, error } = await this.client!.from('residents')
      .select('user_id,username,reserved_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data as Resident | null;
  }
  private async acceptSession(session: Session | null) {
    const generation = ++this.generation;
    this.session = session;
    this.update({
      userId: session?.user.id ?? null,
      resident: null,
      busy: false,
      error: '',
      status: session ? 'loading' : 'guest',
    });
    if (!session) return;
    if (session.user.is_anonymous || !session.user.email_confirmed_at) {
      this.update({ status: 'error', error: 'Sign out and verify your email to register.' });
      return;
    }
    try {
      const resident = await this.readResident(session.user.id);
      if (generation === this.generation)
        this.update({ resident, status: resident ? 'resident' : 'unreserved' });
    } catch {
      if (generation === this.generation) this.update({ status: 'error', error: connectionError });
    }
  }
  private async run(operation: () => Promise<void>, fallback = connectionError) {
    if (!this.client || this.state.busy) return false;
    const generation = this.generation;
    this.update({ busy: true, error: '' });
    try {
      await operation();
      return generation === this.generation;
    } catch (error) {
      if (generation === this.generation) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
        this.update({
          error:
            code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit'
              ? 'Too many attempts. Wait a little before trying again.'
              : fallback,
        });
      }
      return false;
    } finally {
      if (generation === this.generation) this.update({ busy: false });
    }
  }
  checkAvailability = async (input: string): Promise<boolean> => {
    const candidate = normalizeUsername(input);
    const validation = usernameError(candidate);
    if (validation) {
      this.update({ error: validation });
      return false;
    }
    let available = false;
    const completed = await this.run(async () => {
      const { data, error } = await this.client!.rpc('username_available', { candidate });
      if (error || typeof data !== 'boolean') throw error ?? new Error('Invalid availability');
      available = data;
    });
    if (!completed) return false;
    if (!available) this.update({ error: 'That username is already taken. Try another.' });
    return available;
  };
  signInWithGoogle = (redirectTo: string) =>
    this.run(async () => {
      const { error } = await this.client!.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    }, 'Google sign-in could not start. Please try again.');
  reserve = (input: string) => {
    const username = normalizeUsername(input);
    const validation = usernameError(username);
    if (validation) {
      this.update({ error: validation });
      return Promise.resolve(false);
    }
    if (this.state.status !== 'unreserved' || !this.session) return Promise.resolve(false);
    const userId = this.session.user.id;
    const generation = this.generation;
    return this.run(async () => {
      let failure: { code?: string } | null = null;
      try {
        const { data, error } = await this.client!.from('residents')
          .insert({ user_id: userId, username })
          .select('user_id,username,reserved_at')
          .single();
        if (!error && data) {
          if (generation === this.generation)
            this.update({ status: 'resident', resident: data as Resident });
          return;
        }
        failure = error;
      } catch {
        /* The INSERT may have committed even if its response was lost. */
      }
      const resident = await this.readResident(userId);
      if (generation !== this.generation) return;
      if (resident) {
        this.update({ status: 'resident', resident });
        return;
      }
      if (failure?.code === '23505') {
        this.update({ error: 'That username is already taken. Try another.' });
        return;
      }
      throw new Error('Reservation failed');
    });
  };
  signOut = () =>
    this.run(async () => {
      const { error } = await this.client!.auth.signOut({ scope: 'local' });
      if (error) throw error;
    });
}
