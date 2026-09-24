import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';

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
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((crumb, i) => (
          <Fragment key={`${crumb.label}-${crumb.href ?? 'here'}`}>
            {i > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link to={crumb.href}>
                    {crumb.label}{' '}
                    {crumb.arabic ? (
                      <span dir="rtl" lang="ar" className="font-arabic">
                        {crumb.arabic}
                      </span>
                    ) : null}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>
                  {crumb.label}{' '}
                  {crumb.arabic ? (
                    <span dir="rtl" lang="ar" className="font-arabic">
                      {crumb.arabic}
                    </span>
                  ) : null}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
