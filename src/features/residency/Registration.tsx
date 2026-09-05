import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as stylex from '@stylexjs/stylex';
import { s } from '../../styles';
import { supabase } from '../../lib/supabase';
import { ResidencyStore } from './store';
import { savePendingUsername, readPendingUsername, clearPendingUsername } from './pending';
import { normalizeUsername, usernameError } from './username';

const formStyles = stylex.create({
  form: { display: 'grid', gap: 16 },
  label: { display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.6 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#b39b7488',
    borderRadius: 4,
    padding: '12px 14px',
    fontSize: 16,
    color: '#eedcc0',
    backgroundColor: '#172e38',
    outlineOffset: 3,
  },
  secondary: {
    backgroundColor: { default: 'transparent', ':hover': '#ffffff0d' },
    color: '#eedcc0',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#b39b7466',
    borderRadius: 4,
    padding: '12px 16px',
    cursor: 'pointer',
    width: '100%',
    marginTop: 12,
  },
  note: { fontSize: 13, lineHeight: 1.7, margin: '0 0 16px' },
  error: { color: '#ffd4c6', fontSize: 13, lineHeight: 1.7 },
  card: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#d4b58177',
    padding: 22,
    borderRadius: 5,
    marginBottom: 20,
  },
  username: { fontFamily: 'Georgia, serif', fontSize: 27, overflowWrap: 'anywhere' },
});

export function Registration({
  active,
  onClose,
  onRequireUsername,
}: {
  active: boolean;
  onClose: () => void;
  onRequireUsername: () => void;
}) {
  const [store] = useState(() => new ResidencyStore(supabase));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [username, setUsername] = useState(() => readPendingUsername() ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [storageError, setStorageError] = useState('');
  const attemptedClaim = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const promptedUser = useRef<string | null>(null);
  const [returningFromGoogle] = useState(
    () => new URLSearchParams(window.location.search).get('signin') === 'google',
  );
  const handledReturn = useRef(false);
  const normalized = normalizeUsername(username);
  const validation = usernameError(normalized);
  useEffect(() => store.start(), [store]);
  useEffect(() => {
    if (!returningFromGoogle || handledReturn.current || state.status === 'loading') return;
    handledReturn.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('signin');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    onRequireUsername();
  }, [returningFromGoogle, state.status, onRequireUsername]);
  useEffect(() => {
    if (!returningFromGoogle || attemptedClaim.current) return;
    if (state.status === 'resident') {
      attemptedClaim.current = true;
      clearPendingUsername();
      return;
    }
    if (state.status !== 'unreserved' || state.busy) return;
    attemptedClaim.current = true;
    const pending = readPendingUsername();
    clearPendingUsername();
    if (pending) void store.reserve(pending);
  }, [returningFromGoogle, state.status, state.busy, store]);
  async function signUp() {
    if (submitting || state.busy) return;
    setSubmitting(true);
    try {
      if (!(await store.checkAvailability(normalized))) return;
      savePendingUsername(normalized);
      if (!(await store.signInWithGoogle(window.location.origin + '/?signin=google')))
        clearPendingUsername();
    } catch {
      setStorageError(
        'Your browser could not save your chosen name. Enable site storage and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  useEffect(() => {
    if (state.status === 'guest') promptedUser.current = null;
    if (
      (state.status === 'unreserved' || state.status === 'error') &&
      state.userId &&
      promptedUser.current !== state.userId
    ) {
      promptedUser.current = state.userId;
      onRequireUsername();
    }
  }, [state.status, state.userId, onRequireUsername]);
  useEffect(() => {
    if (active) content.current?.querySelector<HTMLElement>('input,button')?.focus();
  }, [active, state.status]);
  return (
    <div ref={content} hidden={!active}>
      {state.status === 'loading' && <p role="status">Checking your residency…</p>}
      {state.status === 'unavailable' && (
        <p {...stylex.props(s.story)}>
          The registration desk is not open yet. You are welcome to explore the town.
        </p>
      )}
      {state.status === 'error' && (
        <button {...stylex.props(s.action)} onClick={() => void store.retry()}>
          Try again
        </button>
      )}
      {(state.status === 'guest' || state.status === 'unreserved') && (
        <form
          {...stylex.props(formStyles.form)}
          onSubmit={(event) => {
            event.preventDefault();
            if (state.status === 'guest') void signUp();
            else void store.reserve(normalized);
          }}
        >
          <h3>
            {state.status === 'guest' ? 'Make yourself at home.' : 'Claim your Yukagecho username'}
          </h3>
          <p {...stylex.props(formStyles.note)}>
            {state.status === 'guest'
              ? 'Choose your name, then continue with Google.'
              : 'Choose the name you’ll use in town.'}
          </p>
          <label {...stylex.props(formStyles.label)}>
            Username
            <input
              {...stylex.props(formStyles.input)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={40}
              required
              value={username}
              disabled={state.busy || submitting}
              aria-describedby="username-help username-preview"
              onChange={(event) => {
                setUsername(event.target.value);
                store.clearError();
                setStorageError('');
              }}
            />
          </label>
          <p id="username-help" {...stylex.props(formStyles.note)}>
            3-20 characters. Use letters, numbers, and underscores.
            <br />
            Choose carefully. Username changes aren’t available yet.
          </p>
          <p id="username-preview" aria-live="polite" {...stylex.props(formStyles.username)}>
            {normalized && !validation ? `@${normalized}` : '@yourname'}
          </p>
          {normalized && validation && <p {...stylex.props(formStyles.error)}>{validation}</p>}
          <button {...stylex.props(s.action)} disabled={state.busy || submitting || !!validation}>
            {state.status === 'guest'
              ? state.busy || submitting
                ? 'Checking…'
                : 'Sign up and own username'
              : state.busy
                ? 'Reserving…'
                : 'Reserve username'}
          </button>
        </form>
      )}
      {state.status === 'guest' && (
        <button
          {...stylex.props(formStyles.secondary)}
          disabled={state.busy || submitting}
          onClick={() => {
            clearPendingUsername();
            void store.signInWithGoogle(window.location.origin + '/?signin=google');
          }}
        >
          Already a resident? Sign in with Google
        </button>
      )}
      {storageError && (
        <p role="alert" {...stylex.props(formStyles.error)}>
          {storageError}
        </p>
      )}
      {state.status === 'resident' && state.resident && (
        <>
          <div {...stylex.props(formStyles.card)}>
            <p {...stylex.props(s.smallText)}>YUKAGECHO RESIDENT CARD</p>
            <p lang="ja" {...stylex.props(s.japaneseName)}>
              湯影町 町民証
            </p>
            <h3 {...stylex.props(formStyles.username)}>
              Welcome to Yukagecho, @{state.resident.username}.
            </h3>
            <p {...stylex.props(formStyles.note)}>
              Your username is reserved. Your story here is just beginning.
            </p>
          </div>
        </>
      )}
      {state.error && (
        <p role="alert" {...stylex.props(formStyles.error)}>
          {state.error}
        </p>
      )}
      {['resident', 'unreserved', 'error'].includes(state.status) && (
        <button
          {...stylex.props(formStyles.secondary)}
          disabled={state.busy || submitting}
          onClick={() => void store.signOut()}
        >
          Sign out
        </button>
      )}
      <button {...stylex.props(formStyles.secondary)} onClick={onClose}>
        {state.status === 'resident' ? 'Back to town' : 'Keep exploring'}
      </button>
    </div>
  );
}
