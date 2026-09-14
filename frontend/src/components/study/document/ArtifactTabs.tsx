/**
 * ArtifactTabs — Brief / Research Plan tab strip.
 */

import { Link } from 'react-router';
import styles from './document.module.css';

interface ArtifactTabsProps {
  active: 'brief' | 'plan';
  studyPublicId: string;
}

export function ArtifactTabs({ active, studyPublicId }: ArtifactTabsProps) {
  return (
    <div className={styles.artifactTabs} role="tablist" aria-label="Study artifacts">
      <Link
        to={`/studies/${studyPublicId}/brief`}
        className={`${styles.artifactTab} ${active === 'brief' ? styles.artifactTabActive : ''}`}
        role="tab"
        aria-selected={active === 'brief'}
      >
        Brief
      </Link>
      <Link
        to={`/studies/${studyPublicId}/plan`}
        className={`${styles.artifactTab} ${active === 'plan' ? styles.artifactTabActive : ''}`}
        role="tab"
        aria-selected={active === 'plan'}
      >
        Research Plan
      </Link>
    </div>
  );
}
