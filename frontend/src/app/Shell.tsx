import { Link, useRouter } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/Button/Button';
import { ToastRegion } from '../ui/Toast';
import styles from './Shell.module.css';
import { ThemeSwitch } from './ThemeSwitch';

/** Inline stroke icons, 20px, currentColor. The specimen draws its own
    icons rather than installing a set, so there is no icon dependency. */
function Icon({ d }: { d: string }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

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

  const role = state.status === 'signed-in' ? state.user.role : null;
  const isTeacher = role === 'teacher' || role === 'admin';

  return (
    <>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      {/* docs/design/specimen.html's shell: two tiers, one sticky block.
          Utility above, destinations below on a rail ground. The earlier
          sidebar draft is gone on purpose: it cost the Arabic a sixth of
          the measure and set two columns of small English down the left
          with nothing to tell them apart. */}
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
          <div className={styles.navTier}>
            <nav aria-label="Corpus" className={styles.navGroup}>
              <p className={styles.navLabel} aria-hidden="true">
                Corpus
              </p>
              <Link to="/collections" className={styles.navLink}>
                <Icon d="M4 5h7v15H4zM13 5h7v15h-7z" />
                Collections
              </Link>
              <Link to="/search" search={{ q: '' }} className={styles.navLink}>
                <Icon d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM16 16l5 5" />
                Search
              </Link>
              <Link to="/narrators" search={{ q: '' }} className={styles.navLink}>
                <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 4-6 8-6s8 2 8 6" />
                Narrators
              </Link>
            </nav>
            <nav aria-label="Study" className={styles.navGroup}>
              <p className={styles.navLabel} aria-hidden="true">
                Study
              </p>
              <Link to="/circles" className={styles.navLink}>
                <Icon d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 3" />
                Circles
              </Link>
              <Link to="/sets" className={styles.navLink}>
                <Icon d="M5 4h14v16H5zM9 8h6M9 12h4" />
                Study sets
              </Link>
              <Link to="/notes" className={styles.navLink}>
                <Icon d="M5 4h14v16H5zM9 12h6M9 16h4" />
                Notes
              </Link>
              {isTeacher ? (
                <Link to="/students" className={styles.navLink}>
                  <Icon d="M4 6h16M4 12h16M4 18h10" />
                  Students
                </Link>
              ) : null}
            </nav>
            <nav aria-label="Account" className={styles.navGroup}>
              <p className={styles.navLabel} aria-hidden="true">
                Account
              </p>
              <Link to="/analytics" className={styles.navLink}>
                <Icon d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
                Analytics
              </Link>
              <Link to="/me" className={styles.navLink}>
                <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 4-6 8-6s8 2 8 6" />
                Account
              </Link>
              {role === 'admin' ? (
                <Link to="/admin/verify" className={styles.navLink}>
                  <Icon d="M9 12a3 3 0 0 1 3-3h2a3 3 0 0 1 0 6h-2M15 12a3 3 0 0 1-3 3h-2a3 3 0 0 1 0-6h2" />
                  Verify teachers
                </Link>
              ) : null}
            </nav>
          </div>
        )}
        {/* docs/frontend-prd.md §7.3: the waiting banner for an unverified
            teacher. A notice, not an error: no status colour, a 2px
            inline-start rule, and the exact consequence stated. */}
        {state.status === 'signed-in' && role === 'teacher' && state.user.is_verified !== true && (
          <p role="note" className={styles.banner}>
            Your teaching account is waiting for review. You can build study sets, write notes, and
            review students. You cannot open a circle yet.
          </p>
        )}
      </div>
      <div className={styles.body}>
        <main id="main" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
      <ToastRegion />
    </>
  );
}
