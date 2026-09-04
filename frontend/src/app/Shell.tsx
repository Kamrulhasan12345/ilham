import type { ReactNode } from 'react';
import styles from './Shell.module.css';
import { ThemeSwitch } from './ThemeSwitch';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <span className={styles.brand}>
            Ilham{' '}
            <span className="ar" dir="rtl">
              إلهام
            </span>
          </span>
          <span className={styles.spacer} />
          <ThemeSwitch />
        </header>
        {/* Destination nav groups (Corpus, Study, ...) are added here, one
            <nav aria-label="..."> per group, as each phase's routes land.
            See the Roadmap in docs/superpowers/plans/2026-09-05-frontend-foundation.md. */}
      </div>
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </>
  );
}
