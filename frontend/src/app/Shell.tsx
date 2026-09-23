import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Menu, MenuButton, MenuText } from '../ui/Menu';
import { ToastRegion } from '../ui/Toast';
import styles from './Shell.module.css';

const CORPUS_PATHS = ['/collections', '/search', '/narrators'];
const STUDY_PATHS = ['/circles', '/sets', '/notes', '/students'];
const ACCOUNT_PATHS = ['/analytics', '/me', '/settings', '/admin/verify'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function Shell({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
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
            <nav className={styles.navTier} aria-label="Primary">
              <Menu label="Corpus" current={startsWithAny(pathname, CORPUS_PATHS)}>
                <Link role="menuitem" className={styles.menuItem} to="/collections">
                  Collections
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/search" search={{ q: '' }}>
                  Search
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/narrators" search={{ q: '' }}>
                  Narrators
                </Link>
              </Menu>
              <Menu label="Study" current={startsWithAny(pathname, STUDY_PATHS)}>
                <Link role="menuitem" className={styles.menuItem} to="/circles">
                  Circles
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/sets">
                  Study sets
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/notes">
                  Notes
                </Link>
                {isTeacher ? (
                  <Link role="menuitem" className={styles.menuItem} to="/students">
                    Students
                  </Link>
                ) : null}
              </Menu>
              <Menu label="Account" current={startsWithAny(pathname, ACCOUNT_PATHS)}>
                {state.status === 'signed-in' ? (
                  <MenuText>
                    {state.user.full_name} · {state.user.role}
                  </MenuText>
                ) : null}
                <Link role="menuitem" className={styles.menuItem} to="/analytics">
                  Analytics
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/me">
                  Account
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/settings">
                  Settings
                </Link>
                {role === 'admin' ? (
                  <Link role="menuitem" className={styles.menuItem} to="/admin/verify">
                    Verify teachers
                  </Link>
                ) : null}
                <MenuButton onClick={() => void handleSignOut()} disabled={isSigningOut}>
                  {isSigningOut ? 'Signing out...' : 'Sign out'}
                </MenuButton>
              </Menu>
            </nav>
          )}
        </header>
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
