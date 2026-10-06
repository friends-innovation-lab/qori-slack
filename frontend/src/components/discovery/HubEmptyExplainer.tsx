/**
 * HubEmptyExplainer — DISC-3 B27
 *
 * Empty state for Discovery Hub when no discovery exists yet.
 * Per DISCOVERY_WORKSPACE_DESIGN_SPEC §4.2.
 *
 * Shows: "What do we already know?" section with entry points for each type.
 */

import { Link } from 'react-router';
import { FileText, Users, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './HubEmptyExplainer.module.css';

interface HubEmptyExplainerProps {
  studyPublicId: string;
}

export function HubEmptyExplainer({ studyPublicId }: HubEmptyExplainerProps) {
  return (
    <div className={styles.explainer}>
      <h2 className={styles.heading}>What do we already know?</h2>
      <p className={styles.description}>
        Discovery collects what exists before you design new research: documents and
        prior studies, what stakeholders are telling you, and survey data you already
        have. Qori analyzes each source, and when you're ready, compares them, so your
        brief starts from evidence.
      </p>

      <div className={styles.rows}>
        <div className={styles.row}>
          <div className={styles.rowContent}>
            <h3 className={styles.rowTitle}>
              <FileText size={16} aria-hidden="true" />
              Documents
            </h3>
            <p className={styles.rowDescription}>
              Upload reports, studies, policy documents, or other desk research.
            </p>
          </div>
          <Link
            to={`/studies/${studyPublicId}/discovery/new/desk`}
            className={styles.rowLink}
          >
            Add documents
          </Link>
        </div>

        <div className={styles.row}>
          <div className={styles.rowContent}>
            <h3 className={styles.rowTitle}>
              <Users size={16} aria-hidden="true" />
              Stakeholder material
            </h3>
            <p className={styles.rowDescription}>
              Upload interview transcripts, meeting notes, or stakeholder feedback.
            </p>
          </div>
          <Link
            to={`/studies/${studyPublicId}/discovery/new/stakeholder`}
            className={styles.rowLink}
          >
            Add interviews
          </Link>
        </div>

        <div className={styles.row}>
          <div className={styles.rowContent}>
            <h3 className={styles.rowTitle}>
              <BarChart2 size={16} aria-hidden="true" />
              Survey data
            </h3>
            <p className={styles.rowDescription}>
              Upload a CSV of survey responses for analysis.
            </p>
          </div>
          {/* DISC-4: Survey intake not yet available */}
          <Button variant="ghost" size="sm" disabled>
            Coming soon
          </Button>
        </div>
      </div>

      <p className={styles.skipLine}>
        Or,{' '}
        <Link to={`/studies/${studyPublicId}/brief/new`} className={styles.skipLink}>
          start the brief without Discovery
        </Link>
      </p>
    </div>
  );
}
