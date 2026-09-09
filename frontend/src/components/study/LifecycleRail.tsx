/**
 * LifecycleRail — Study navigation as lifecycle + dependency spine.
 * Each node shows: label, count, state (locked/warning/suggested/free/current).
 * Locked nodes announce unlock condition.
 */

import { NavLink } from 'react-router';
import { Lock, AlertTriangle, ArrowRight, Circle } from 'lucide-react';
import type { LifecycleNode } from '@qori/api-contracts';
import styles from './LifecycleRail.module.css';

interface LifecycleRailProps {
  studyPublicId: string;
  nodes: LifecycleNode[];
}

const stateIcons = {
  locked: Lock,
  readiness_warning: AlertTriangle,
  suggested: ArrowRight,
  free: Circle,
  current: Circle,
};

const stageRoutes: Record<string, string> = {
  overview: '',
  brief: '/brief',
  plan: '/plan',
  sources: '/sources',
  evidence: '/evidence',
  findings: '/findings',
  outputs: '/outputs',
};

export function LifecycleRail({ studyPublicId, nodes }: LifecycleRailProps) {
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
                onClick={(e) => { if (isLocked) e.preventDefault(); }}
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
