import type { ReactNode } from 'react';
import { type Crumb, Crumbs } from '../domain/Crumbs';

/** The top of every app page: where you are, what this page is, and what
    you can do here. Pages put their primary action in `actions`. */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {crumbs ? <Crumbs trail={crumbs} /> : null}
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
