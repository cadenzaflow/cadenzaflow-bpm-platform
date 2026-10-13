import type { ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem } from '@carbon/react';

interface PageFrameProps {
  title: string;
  /** links (or text) above the title, e.g. Users › demo */
  breadcrumbs?: ReactNode[];
  /** buttons next to the title */
  actions?: ReactNode;
  children: ReactNode;
}

/** Frame of a page: breadcrumbs, title, actions, content. */
export function PageFrame({ title, breadcrumbs, actions, children }: PageFrameProps) {
  return (
    <section className="cz-page">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb noTrailingSlash className="cz-page__breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <BreadcrumbItem key={index} isCurrentPage={index === breadcrumbs.length - 1}>
              {crumb}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      )}
      <header className="cz-page__header">
        <h1 className="cz-page__title">{title}</h1>
        {actions && <div className="cz-page__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
