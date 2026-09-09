/**
 * Card — Container with flat border, hover tint (not shadow lift).
 * Whole card clickable when `to` is provided.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './Card.module.css';

interface CardProps {
  to?: string;
  children: ReactNode;
  className?: string;
  padding?: 'default' | 'compact';
}

export function Card({ to, children, className, padding = 'default' }: CardProps) {
  const cls = `${styles.card} ${styles[padding]} ${className || ''}`;

  if (to) {
    return (
      <Link to={to} className={`${cls} ${styles.interactive}`}>
        {children}
      </Link>
    );
  }

  return <div className={cls}>{children}</div>;
}
