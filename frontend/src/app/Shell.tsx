import { Link, useRouter } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/Button/Button';
import styles from './Shell.module.css';
import { ThemeSwitch } from './ThemeSwitch';

export function Shell({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      await router.navigate({ to: '/login' });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <span className={styles.brand}>
            Ilham{' '}
            <span className={`ar ${styles.brandAr}`} dir="rtl">
              إلهام
            </span>
          </span>
          <span className={styles.spacer} />
          {state.status === 'signed-in' && (
            <span className={styles.identity}>
              {state.user.full_name} · {state.user.role}
            </span>
          )}
          <ThemeSwitch />
          {state.status === 'signed-in' && (
            <Button variant="default" size="small" onClick={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </Button>
          )}
        </header>
        {state.status === 'signed-in' && (
          // A plain <a> forces a full browser reload on every click, which
          // reruns AuthProvider's startup /auth/refresh + /auth/me round trip
          // and flashes a loading state. <Link> navigates inside the SPA, and
          // its typed `to` makes a mistyped path a compile error instead of a
          // silent 404 at click time.
          <nav aria-label="Primary" className={styles.nav}>
            <Link to="/collections">Collections</Link>
            <Link to="/circles">Circles</Link>
            <Link to="/notes">Notes</Link>
            {(state.user.role === 'teacher' || state.user.role === 'admin') && (
              <Link to="/students">Students</Link>
            )}
            {state.user.role === 'admin' && <Link to="/admin/verify">Verify teachers</Link>}
          </nav>
        )}
        {/* docs/frontend-prd.md §7.3: the waiting banner for an unverified
            teacher. A notice, not an error: no status colour, a 2px
            inline-start rule, and the exact consequence stated. */}
        {state.status === 'signed-in' &&
          state.user.role === 'teacher' &&
          state.user.is_verified !== true && (
            <p role="note" className={styles.banner}>
              Your teaching account is waiting for review. You can build study sets, write notes,
              and review students. You cannot open a circle yet.
            </p>
          )}
      </div>
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </>
  );
}
