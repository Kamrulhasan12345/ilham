import { useQueryClient } from '@tanstack/react-query';
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
import { flushSync } from 'react-dom';
import { z } from 'zod';
import { apiFetch, onSessionLost, refreshAccessToken, setAccessToken } from '../lib/apiClient';
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

// Exported for tests only: router-level tests render <RouterProvider> with a
// fake router context and give Shell the same auth through this provider,
// instead of mounting a real AuthProvider (which would hit the network).
export { AuthContext };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // main.tsx mounts AuthProvider inside QueryClientProvider, so this hook
  // always resolves. Every sign-in, sign-out, and session loss clears the
  // query cache: without it the next account inherits the previous one's
  // rows (teacher circles rendered for a student) until a hard refresh.
  const queryClient = useQueryClient();

  const readyRef = useRef<{ promise: Promise<AuthState>; resolve: (s: AuthState) => void }>();
  if (!readyRef.current) {
    let resolve!: (s: AuthState) => void;
    const promise = new Promise<AuthState>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  const establishSession = useCallback(
    async (accessToken: string): Promise<void> => {
      // Drop the previous account's rows before loading the new one's.
      queryClient.clear();
      setAccessToken(accessToken);
      const user = await apiFetch('/auth/me', meSchema);
      // flushSync forces the re-render (and, with it, RouterProvider's fresh
      // `context={{ auth }}` prop) to commit synchronously before this promise
      // resolves. Without it, a caller's `await signIn(token); navigate(...)`
      // races React's own batching: `navigate()` runs in the same microtask as
      // this setState, so the router still holds the pre-sign-in (signed-out)
      // context and immediately guards the new location back to /login.
      flushSync(() => {
        setState({ status: 'signed-in', user });
      });
    },
    [queryClient],
  );

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

  // The router side of session loss (invalidate, so guards re-run) lives in
  // main.tsx's InnerApp, which owns the router instance. This context never
  // imports the router singleton: that import closes a cycle
  // (AuthContext -> router -> routeTree -> __root -> Shell -> AuthContext)
  // that crashes any test importing a route module first.
  useEffect(() => {
    return onSessionLost(() => {
      queryClient.clear();
      setState({ status: 'signed-out' });
    });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      ready: readyRef.current!.promise,
      signIn: establishSession,
      signOut: async () => {
        try {
          await apiFetch('/auth/logout', z.unknown(), { method: 'POST' });
        } catch {
          // Best-effort: the user is signed out locally even if the network call fails.
        } finally {
          setAccessToken(null);
          queryClient.clear();
          setState({ status: 'signed-out' });
        }
      },
    }),
    [state, establishSession, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
