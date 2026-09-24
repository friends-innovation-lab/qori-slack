/**
 * LifecycleRail — Study navigation as lifecycle + dependency spine.
 * Each node shows: label, count, state (locked/warning/suggested/free/current).
 * Locked nodes announce unlock condition.
 *
 * Variants:
 * - default: Light panel, 200px, with spine line
 * - inverse: Dark panel, 224px, with study header (for workspace routes)
 */

import { NavLink } from 'react-router';
import { Lock, AlertTriangle, ArrowRight, Circle } from 'lucide-react';
import type { LifecycleNode } from '@qori/api-contracts';
import { stageRoutes } from './lifecycle';
import styles from './LifecycleRail.module.css';

interface StudyHeader {
  /** Study name displayed in the header */
  name: string;
  /** "Back to X" link destination */
  backTo: string;
  /** "Back to X" link label (e.g., "All projects") */
  backLabel: string;
  /** Optional org name shown as eyebrow (defaults to "Study") */
  orgName?: string;
}

interface LifecycleRailProps {
  studyPublicId: string;
  nodes: LifecycleNode[];
  /** Visual variant: default (light) or inverse (dark, for workspace) */
  variant?: 'default' | 'inverse';
  /** Study header info (required for inverse variant) */
  study?: StudyHeader;
}

const stateIcons = {
  locked: Lock,
  readiness_warning: AlertTriangle,
  suggested: ArrowRight,
  free: Circle,
  current: Circle,
};

export function LifecycleRail({
  studyPublicId,
  nodes,
  variant = 'default',
  study,
}: LifecycleRailProps) {
  const isInverse = variant === 'inverse';

  // Inverse variant with study header
  if (isInverse) {
    return (
      <nav
        className={`${styles.rail} ${styles.railInverse}`}
        aria-label="Study lifecycle"
      >
        {study && (
          <div className={styles.studyHead}>
            <p className={styles.studyEyebrow}>{study.orgName ?? 'Study'}</p>
            <p className={styles.studyName}>{study.name}</p>
            <a className={styles.studyBack} href={study.backTo}>
              ← {study.backLabel}
            </a>
          </div>
        )}
        <ul className={styles.list}>
          {nodes.map((node) => {
            const Icon = stateIcons[node.state] || Circle;
            const route = stageRoutes[node.stage] ?? '';
            const to = `/studies/${studyPublicId}${route}`;
            const isLocked = node.state === 'locked';

            return (
              <li key={node.stage} className={styles.item}>
                <NavLink
                  to={to}
                  end={route === ''}
                  className={({ isActive }) =>
                    `${styles.node} ${styles[node.state]} ${isActive ? styles.active : ''}`
                  }
                  aria-current={node.is_current ? 'step' : undefined}
                  aria-disabled={isLocked || undefined}
                  aria-label={`${node.label}${node.count > 0 ? `, ${node.count} items` : ''}${isLocked ? `, locked: ${node.unlock_hint}` : ''}`}
                  data-current={node.is_current || undefined}
                  onClick={(e) => {
                    if (isLocked) e.preventDefault();
                  }}
                >
                  <Icon size={16} className={styles.icon} aria-hidden="true" />
                  <span className={styles.label}>{node.label}</span>
                  {node.count > 0 && (
                    <span className={styles.count}>{node.count}</span>
                  )}
                </NavLink>
                {isLocked && node.unlock_hint && (
                  <span className={styles.hint}>{node.unlock_hint}</span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  // Default variant (light)
  return (
    <nav className={styles.rail} aria-label="Study lifecycle">
      <ul className={styles.list}>
        {nodes.map((node) => {
          const Icon = stateIcons[node.state] || Circle;
          const route = stageRoutes[node.stage] ?? '';
          const to = `/studies/${studyPublicId}${route}`;
          const isLocked = node.state === 'locked';

          return (
            <li key={node.stage} className={styles.item}>
              <NavLink
                to={to}
                end={route === ''}
                className={({ isActive }) =>
                  `${styles.node} ${styles[node.state]} ${isActive ? styles.active : ''}`
                }
                aria-disabled={isLocked}
                aria-label={`${node.label}${node.count > 0 ? `, ${node.count} items` : ''}${node.state === 'locked' ? `, locked: ${node.unlock_hint}` : ''}`}
                onClick={(e) => {
                  if (isLocked) e.preventDefault();
                }}
              >
                {node.is_current && (
                  <span className={styles.currentMarker} aria-hidden="true" />
                )}
                <Icon size={16} className={styles.icon} aria-hidden="true" />
                <span className={styles.label}>{node.label}</span>
                {node.count > 0 && (
                  <span className={styles.count}>{node.count}</span>
                )}
              </NavLink>
              {isLocked && node.unlock_hint && (
                <span className={styles.hint}>{node.unlock_hint}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
