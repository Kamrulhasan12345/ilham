import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';
import styles from './Crumbs.module.css';

export interface Crumb {
  label: string;
  href?: string;
  arabic?: string;
}

/** The way back up: collection, chapter, hadith. A missing middle
    survives — the crumb for a hadith with no chapter skips it and the
    trail still reads. */
export function Crumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol className={styles.list}>
        {trail.map((crumb, i) => (
          <li key={`${crumb.label}-${crumb.href ?? 'here'}`} className={styles.item}>
            {i > 0 ? (
              <span aria-hidden="true" className={styles.sep}>
                /
              </span>
            ) : null}
            {crumb.href ? (
              <Link to={crumb.href}>
                {crumb.label}{' '}
                {crumb.arabic ? (
                  <span className="ar" dir="rtl">
                    {crumb.arabic}
                  </span>
                ) : null}
              </Link>
            ) : (
              <Fragment>
                <span aria-current="page">{crumb.label}</span>{' '}
                {crumb.arabic ? (
                  <span className="ar" dir="rtl">
                    {crumb.arabic}
                  </span>
                ) : null}
              </Fragment>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
