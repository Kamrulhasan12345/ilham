import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { apiFetch, onSessionLost, refreshAccessToken, setAccessToken } from '../lib/apiClient';
import { router } from '../router';
import type { AuthState } from './guards';

export type { AuthState, AuthUser, Role, GuardRequirement, GuardResult } from './guards';
export { evaluateGuard } from './guards';

const meSchema = z.object({
  user_id: z.number(),
  role: z.enum(['student', 'teacher', 'admin']),
  full_name: z.string(),
  email: z.string(),
  is_verified: z.boolean().optional(),
});

export interface AuthContextValue {
  state: AuthState;
  /** Resolves with the final AuthState once the startup check (§5.3 step 1) finishes. */
  ready: Promise<AuthState>;
  signIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const readyRef = useRef<{ promise: Promise<AuthState>; resolve: (s: AuthState) => void }>();
  if (!readyRef.current) {
    let resolve!: (s: AuthState) => void;
    const promise = new Promise<AuthState>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  const establishSession = useCallback(async (accessToken: string): Promise<void> => {
    setAccessToken(accessToken);
    const user = await apiFetch('/auth/me', meSchema);
    setState({ status: 'signed-in', user });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let finalState: AuthState;
      try {
        const accessToken = await refreshAccessToken();
        setAccessToken(accessToken);
        const user = await apiFetch('/auth/me', meSchema);
        finalState = { status: 'signed-in', user };
      } catch {
        finalState = { status: 'signed-out' };
      }
      if (!cancelled) setState(finalState);
      readyRef.current!.resolve(finalState);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onSessionLost(() => {
      setState({ status: 'signed-out' });
      router.invalidate();
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      ready: readyRef.current!.promise,
      signIn: establishSession,
      signOut: async () => {
        try {
          await apiFetch('/auth/logout', z.unknown(), { method: 'POST', credentials: 'include' });
        } catch {
          // Best-effort: the user is signed out locally even if the network call fails.
        } finally {
          setAccessToken(null);
          setState({ status: 'signed-out' });
        }
      },
    }),
    [state, establishSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
