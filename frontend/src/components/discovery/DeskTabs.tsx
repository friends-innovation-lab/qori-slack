/**
 * DeskTabs — Shared tab navigation for Desk Research pages.
 *
 * DR-6b-4c: Extracted from DeskInsightsPage/DeskSourcesPage to support
 * the Desk readouts tab. Preserves existing counts, active states,
 * navigation, and accessibility.
 *
 * Tab label "Desk readouts" per D-RO13 (settled).
 */

import { Link } from 'react-router';
import styles from './DeskTabs.module.css';

export type DeskTabId = 'insights' | 'sources' | 'readouts';

export interface DeskTabCounts {
  insights?: number;
  sources?: number;
  readouts?: number;
}

export interface DeskTabsProps {
  studyPublicId: string;
  activeTab: DeskTabId;
  counts?: DeskTabCounts;
}

interface TabConfig {
  id: DeskTabId;
  label: string;
  path: string;
}

const TABS: TabConfig[] = [
  { id: 'insights', label: 'Insights', path: '' },
  { id: 'sources', label: 'Sources', path: '/sources' },
  { id: 'readouts', label: 'Desk readouts', path: '/readouts' },
];

export function DeskTabs({ studyPublicId, activeTab, counts }: DeskTabsProps) {
  return (
    <div className={styles.headerTabs} role="tablist">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        const count = counts?.[tab.id];
        const showCount = typeof count === 'number' && count > 0;

        return (
          <Link
            key={tab.id}
            to={`/studies/${studyPublicId}/discovery/desk${tab.path}`}
            role="tab"
            aria-selected={isActive}
            className={`${styles.headerTab} ${isActive ? styles.headerTabActive : ''}`}
          >
            {tab.label}
            {showCount && <span className={styles.tabCount}>{count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
