/**
 * LifecycleRail — Study navigation as lifecycle + dependency spine.
 *
 * Variants:
 * - default: Light panel, 200px, flat list with spine line and state icons
 * - inverse: Dark panel, 224px, grouped lifecycle per CD (VC-2A)
 *
 * VC-2A: The inverse variant renders the approved CD composition:
 * - 5 groups, 16 items (LIFECYCLE_NAV_CONVERGENCE.md §1 + DISC-3)
 * - Discovery rows, Brief, and Plan are routes
 * - Synthesis is a placeholder until DISC-5
 * - Study name links to StudyOverview
 * - Plan lock state from computeLifecycleNodes
 *
 * DISC-3: Discovery rows show Ready artifact counts and needs-review brass dots.
 */

import { NavLink, Link, useLocation } from 'react-router';
import { Lock, AlertTriangle, ArrowRight, Circle } from 'lucide-react';
import type { LifecycleNode } from '@qori/api-contracts';
import { stageRoutes } from './lifecycle';
import { WORKSPACE_LIFECYCLE, type WorkspaceNavItem, type DiscoveryTypeFilter } from './workspaceLifecycle';
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

/**
 * DISC-3: Discovery counts per type.
 * Count = Ready artifacts of that type. null = loading.
 */
export interface DiscoveryCounts {
  desk: number | null;
  stakeholder: number | null;
  survey: number | null;
  /** Whether any run needs researcher review (gate pending, failed, expiring) */
  needsReview: {
    desk: boolean;
    stakeholder: boolean;
    survey: boolean;
  };
}

interface LifecycleRailProps {
  studyPublicId: string;
  nodes: LifecycleNode[];
  /** Visual variant: default (light) or inverse (dark, for workspace) */
  variant?: 'default' | 'inverse';
  /** Study header info (required for inverse variant) */
  study?: StudyHeader;
  /** DISC-3: Discovery counts per type (for inverse variant) */
  discoveryCounts?: DiscoveryCounts;
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
  discoveryCounts,
}: LifecycleRailProps) {
  const isInverse = variant === 'inverse';
  const location = useLocation();

  // VC-2A: For inverse variant, get Plan lock state from computeLifecycleNodes
  const planNode = nodes.find((n) => n.stage === 'plan');
  const isPlanLocked = planNode?.state === 'locked';

  // Helper to check if an item should be locked
  const isLocked = (item: WorkspaceNavItem): boolean => {
    if (item.kind !== 'route') return false;
    return item.stage === 'plan' && isPlanLocked;
  };

  // DISC-3: Get discovery count for a type
  const getDiscoveryCount = (filterType: DiscoveryTypeFilter | null): number | null => {
    if (!discoveryCounts) return null;
    if (filterType === null) {
      // "All evidence" shows sum of all types.
      // DISC-3 exactness: If ANY type count is null (indeterminate), sum is also null.
      // This prevents displaying a misleading partial sum as definitive.
      const { desk, stakeholder, survey } = discoveryCounts;
      if (desk === null || stakeholder === null || survey === null) {
        return null;
      }
      return desk + stakeholder + survey;
    }
    return discoveryCounts[filterType];
  };

  // DISC-3: Check if a type needs review
  const getNeedsReview = (filterType: DiscoveryTypeFilter | null): boolean => {
    if (!discoveryCounts?.needsReview) return false;
    if (filterType === null) {
      // "All evidence" shows dot if any type needs review
      return (
        discoveryCounts.needsReview.desk ||
        discoveryCounts.needsReview.stakeholder ||
        discoveryCounts.needsReview.survey
      );
    }
    return discoveryCounts.needsReview[filterType];
  };

  // DISC-3: Check if discovery route is active (handle query params)
  const isDiscoveryActive = (item: WorkspaceNavItem): boolean => {
    if (item.kind !== 'discovery-route') return false;
    const discoveryBase = `/studies/${studyPublicId}/discovery`;
    if (!location.pathname.startsWith(discoveryBase)) return false;

    // For hub routes, match query param
    if (location.pathname === discoveryBase || location.pathname === `${discoveryBase}/`) {
      const params = new URLSearchParams(location.search);
      const typeParam = params.get('type');
      if (item.path === '') {
        // "All evidence" is active when no type filter
        return !typeParam;
      }
      // Type-filtered routes match their type param
      return item.path === `?type=${typeParam}`;
    }
    return false;
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

        {/* VC-2A + DISC-3: Grouped lifecycle — 5 groups, 16 items */}
        {WORKSPACE_LIFECYCLE.map(({ group, items }) => (
          <section key={group} aria-labelledby={`lc-${group.toLowerCase()}`}>
            <h2 id={`lc-${group.toLowerCase()}`} className={styles.grp}>
              {group}
            </h2>
            <ul className={styles.list}>
              {items.map((item) => {
                // DISC-3: Discovery routes
                if (item.kind === 'discovery-route') {
                  const to = `/studies/${studyPublicId}/discovery${item.path}`;
                  const count = getDiscoveryCount(item.filterType);
                  const needsReview = getNeedsReview(item.filterType);
                  const isActive = isDiscoveryActive(item);

                  return (
                    <li key={item.label}>
                      <NavLink
                        to={to}
                        className={`${styles.nv} ${isActive ? styles.nvOn : ''}`}
                      >
                        <span className={styles.nvText}>{item.label}</span>
                        {count !== null && count > 0 && (
                          <span className={styles.nvCount}>{count}</span>
                        )}
                        {needsReview && (
                          <>
                            <span className={styles.nvDot} aria-hidden="true" />
                            <span className={styles.srOnly}>, needs your review</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                }

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
