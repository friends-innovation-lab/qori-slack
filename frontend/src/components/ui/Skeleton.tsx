/**
 * Skeleton — Loading placeholder matching final layout.
 * Delay ≥300ms to avoid flash per design spec.
 */

import { useState, useEffect } from 'react';
import styles from './Skeleton.module.css';

type SkeletonVariant = 'text' | 'card' | 'row' | 'circle';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  count?: number;
  delay?: number;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  count = 1,
  delay = 300,
  className,
}: SkeletonProps) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  return (
    <div className={`${styles.container} ${className || ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`${styles.skeleton} ${styles[variant]}`}
          style={{ width, height }}
        />
      ))}
    </div>
  );
}
