/**
 * LifecycleRail — Study navigation as lifecycle + dependency spine.
 *
 * Variants:
 * - default: Light panel, 200px, flat list with spine line and state icons
 * - inverse: Dark panel, 224px, grouped lifecycle per CD (VC-2A)
 *
 * VC-2A: The inverse variant renders the approved CD composition:
 * - 5 groups, 15 items (LIFECYCLE_NAV_CONVERGENCE.md §1)
 * - Only Research Brief and Research Plan are real routes
 * - 13 placeholders are non-interactive
 * - Study name links to StudyOverview
 * - Plan lock state from computeLifecycleNodes
 */

import { NavLink, Link } from 'react-router';
import { Lock, AlertTriangle, ArrowRight, Circle } from 'lucide-react';
import type { LifecycleNode } from '@qori/api-contracts';
import { stageRoutes } from './lifecycle';
import { WORKSPACE_LIFECYCLE, type WorkspaceNavItem } from './workspaceLifecycle';
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

  // VC-2A: For inverse variant, get Plan lock state from computeLifecycleNodes
  const planNode = nodes.find((n) => n.stage === 'plan');
  const isPlanLocked = planNode?.state === 'locked';

  // Helper to check if an item should be locked
  const isLocked = (item: WorkspaceNavItem): boolean => {
    if (item.kind !== 'route') return false;
    return item.stage === 'plan' && isPlanLocked;
  };

  // VC-2A: Inverse variant with grouped lifecycle
  if (isInverse) {
    return (
      <nav
        className={`${styles.rail} ${styles.railInverse}`}
        aria-label="Study lifecycle"
      >
        {study && (
          <div className={styles.studyHead}>
            <p className={styles.studyEyebrow}>{study.orgName ?? 'Study'}</p>
            {/* VC-2A: Study name links to StudyOverview */}
            <Link to={`/studies/${studyPublicId}`} className={styles.studyName}>
              {study.name}
            </Link>
            <a className={styles.studyBack} href={study.backTo}>
              ← {study.backLabel}
            </a>
          </div>
        )}

        {/* VC-2A: Grouped lifecycle — 5 groups, 15 items */}
        {WORKSPACE_LIFECYCLE.map(({ group, items }) => (
          <section key={group} aria-labelledby={`lc-${group.toLowerCase()}`}>
            <h2 id={`lc-${group.toLowerCase()}`} className={styles.grp}>
              {group}
            </h2>
            <ul className={styles.list}>
              {items.map((item) => {
                if (item.kind === 'route') {
                  const route = stageRoutes[item.stage] ?? '';
                  const to = `/studies/${studyPublicId}${route}`;
                  const locked = isLocked(item);

                  return (
                    <li key={item.label}>
                      <NavLink
                        to={to}
                        className={({ isActive }) =>
                          `${styles.nv} ${isActive ? styles.nvOn : ''} ${locked ? styles.nvLocked : ''}`
                        }
                        aria-disabled={locked || undefined}
                        title={locked ? planNode?.unlock_hint ?? undefined : undefined}
                        onClick={(e) => {
                          if (locked) e.preventDefault();
                        }}
                      >
                        <span className={styles.nvText}>{item.label}</span>
                        {locked && (
                          <>
                            <Lock size={12} className={styles.nvLockIcon} aria-hidden="true" />
                            <span className={styles.srOnly}>, locked: {planNode?.unlock_hint}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                }

                // Placeholder — non-interactive
                return (
                  <li key={item.label} className={styles.nvPlaceholder}>
                    <span className={styles.nvText}>{item.label}</span>
                    <span className={styles.srOnly}>, not yet available</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className={styles.spacer} aria-hidden="true" />
      </nav>
    );
  }

  // Default variant (light) — unchanged from original
  return (
    <nav className={styles.rail} aria-label="Study lifecycle">
      <ul className={styles.list}>
        {nodes.map((node) => {
          const Icon = stateIcons[node.state] || Circle;
          const route = stageRoutes[node.stage] ?? '';
          const to = `/studies/${studyPublicId}${route}`;
          const nodeLocked = node.state === 'locked';

          return (
            <li key={node.stage} className={styles.item}>
              <NavLink
                to={to}
                end={route === ''}
                className={({ isActive }) =>
                  `${styles.node} ${styles[node.state]} ${isActive ? styles.active : ''}`
                }
                aria-disabled={nodeLocked}
                aria-label={`${node.label}${node.count > 0 ? `, ${node.count} items` : ''}${node.state === 'locked' ? `, locked: ${node.unlock_hint}` : ''}`}
                onClick={(e) => {
                  if (nodeLocked) e.preventDefault();
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
              {nodeLocked && node.unlock_hint && (
                <span className={styles.hint}>{node.unlock_hint}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
