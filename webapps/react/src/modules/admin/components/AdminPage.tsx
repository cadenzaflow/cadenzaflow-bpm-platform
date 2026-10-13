import type { ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem } from '@carbon/react';

interface AdminPageProps {
  title: string;
  /** links (or text) above the title, e.g. Users › demo */
  breadcrumbs?: ReactNode[];
  /** buttons next to the title */
  actions?: ReactNode;
  children: ReactNode;
}

/** Frame of an Admin page: breadcrumbs, title, actions, content. */
export function AdminPage({ title, breadcrumbs, actions, children }: AdminPageProps) {
  return (
    <section className="cz-admin-page">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb noTrailingSlash className="cz-admin-page__breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <BreadcrumbItem key={index} isCurrentPage={index === breadcrumbs.length - 1}>
              {crumb}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      )}
      <header className="cz-admin-page__header">
        <h1 className="cz-admin-page__title">{title}</h1>
        {actions && <div className="cz-admin-page__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
