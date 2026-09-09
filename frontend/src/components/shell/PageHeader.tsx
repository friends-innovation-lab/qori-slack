/**
 * PageHeader — Screen title, context metadata, primary action.
 * Breadcrumbs rendered above h1; action group to the right.
 */

import type { ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  title,
  breadcrumbs,
  meta,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <div className={styles.header}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}

      <div className={styles.row}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{title}</h1>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>

        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      {children}
    </div>
  );
}
