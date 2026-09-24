/**
 * ArtifactHeader — Header bar for workspace document routes.
 *
 * Contains: nav toggle (≤980px), breadcrumb, artifact tabs, save state,
 * GitHub link, rail toggles, and edit/save actions.
 *
 * CC-4: New component for Plan migration (§3.4).
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Menu } from 'lucide-react';
import { ArtifactTabs } from './ArtifactTabs';
import styles from './ArtifactHeader.module.css';

interface ArtifactHeaderProps {
  /** Study name for breadcrumb */
  studyName: string;
  /** Study public ID for routing */
  studyPublicId: string;
  /** Which artifact tab is active */
  active: 'brief' | 'plan';
  /** Save state indicator (rendered in header) */
  saveState?: ReactNode;
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

export function ArtifactHeader({
  studyName,
  studyPublicId,
  active,
  saveState,
  githubUrl,
  railToggles,
  actions,
  navOpen,
  onNavToggle,
}: ArtifactHeaderProps) {
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

      {/* Save state */}
      {saveState}

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

      {/* Rail toggles */}
      {railToggles}

      {/* Actions */}
      <div className={styles.actions}>{actions}</div>
    </header>
  );
}
