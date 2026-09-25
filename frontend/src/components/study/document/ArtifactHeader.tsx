/**
 * ArtifactHeader — Header bar for workspace document routes.
 *
 * Contains: nav toggle (≤980px), breadcrumb, artifact tabs, save state,
 * GitHub link, rail toggles, and edit/save actions.
 *
 * CC-4: New component for Plan migration (§3.4).
 * VC-2A: Added persistent status indicator per COMPONENT_DELTAS §2.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Menu } from 'lucide-react';
import { ArtifactTabs } from './ArtifactTabs';
import styles from './ArtifactHeader.module.css';
import docStyles from './document.module.css';

/**
 * VC-2A: Persistent status indicator.
 * Shown when no save activity is in progress.
 */
interface ArtifactStatus {
  tone: 'neutral' | 'warning' | 'success' | 'error';
  label: string;
}

interface ArtifactHeaderProps {
  /** Study name for breadcrumb */
  studyName: string;
  /** Study public ID for routing */
  studyPublicId: string;
  /** Which artifact tab is active */
  active: 'brief' | 'plan';
  /** Save state indicator (rendered in header during save activity) */
  saveState?: ReactNode;
  /**
   * VC-2A: Persistent artifact status.
   * Displayed when saveState is null/undefined.
   * Brief: approval status (pending/changes requested/approved)
   * Plan: version display (e.g., "v1.2")
   */
  status?: ArtifactStatus;
  /** GitHub URL for the artifact */
  githubUrl?: string | null;
  /** Rail toggle buttons (e.g., Review panel toggle) */
  railToggles?: ReactNode;
  /** Action buttons (Edit, Cancel, Save) */
  actions: ReactNode;
  /** Whether the nav drawer is open */
  navOpen: boolean;
  /** Toggle nav drawer open/close */
  onNavToggle: () => void;
}

/**
 * Map status tone to CSS class name suffix.
 */
const toneClasses: Record<ArtifactStatus['tone'], string> = {
  neutral: docStyles.saveDotNeutral,
  warning: docStyles.saveDotDirty,
  success: '', // default (green)
  error: docStyles.saveDotError,
};

export function ArtifactHeader({
  studyName,
  studyPublicId,
  active,
  saveState,
  status,
  githubUrl,
  railToggles,
  actions,
  navOpen,
  onNavToggle,
}: ArtifactHeaderProps) {
  // VC-2A: Render persistent status when saveState is null
  const statusIndicator = saveState ?? (
    status && (
      <span className={docStyles.saveState}>
        <span
          className={`${docStyles.saveDot} ${toneClasses[status.tone] || ''}`}
          aria-hidden="true"
        />
        {status.label}
      </span>
    )
  );

  return (
    <header className={styles.header}>
      {/* Nav toggle (visible ≤980px) */}
      <button
        type="button"
        className={styles.navToggle}
        aria-label="Study navigation"
        aria-expanded={navOpen}
        aria-controls="workspace-nav"
        onClick={onNavToggle}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* Breadcrumb */}
      <nav className={styles.crumb} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to={`/studies/${studyPublicId}`}>{studyName}</Link>
          </li>
        </ol>
      </nav>

      {/* Artifact tabs */}
      <ArtifactTabs active={active} studyPublicId={studyPublicId} />

      {/* Spacer */}
      <span className={styles.grow} />

      {/* VC-2A: Status indicator (save state or persistent status) */}
      {statusIndicator}

      {/* GitHub link */}
      {githubUrl && (
        <a
          className={styles.githubLink}
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      )}

      {/* Separator */}
      {(railToggles || actions) && (
        <span className={styles.rule} aria-hidden="true" />
      )}

      {/* Actions */}
      <div className={styles.actions}>{actions}</div>

      {/* Rail toggles (CD order: after actions) */}
      {railToggles}
    </header>
  );
}
