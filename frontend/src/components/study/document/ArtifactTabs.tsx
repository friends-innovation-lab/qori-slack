/**
 * ArtifactTabs — Brief / Research Plan tab strip.
 *
 * CC-4: Fixed PF-06 - use nav semantics instead of tab semantics.
 * These are navigation links, not an ARIA tab widget.
 */

import { Link } from 'react-router';
import styles from './document.module.css';

interface ArtifactTabsProps {
  active: 'brief' | 'plan';
  studyPublicId: string;
}

export function ArtifactTabs({ active, studyPublicId }: ArtifactTabsProps) {
  return (
    <nav className={styles.artifactTabs} aria-label="Study artifacts">
      <ul>
        <li>
          <Link
            to={`/studies/${studyPublicId}/brief`}
            className={`${styles.artifactTab} ${active === 'brief' ? styles.artifactTabActive : ''}`}
            aria-current={active === 'brief' ? 'page' : undefined}
          >
            Brief
          </Link>
        </li>
        <li>
          <Link
            to={`/studies/${studyPublicId}/plan`}
            className={`${styles.artifactTab} ${active === 'plan' ? styles.artifactTabActive : ''}`}
            aria-current={active === 'plan' ? 'page' : undefined}
          >
            Research Plan
          </Link>
        </li>
      </ul>
    </nav>
  );
}
