/**
 * Brief Detail — Read view + approval banner.
 * Approval is in-context: banner + decision bar, not a separate app.
 * Contract: screens/brief-approval.md
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useStudyBrief } from '@/api/queries/useStudy';
import { useApproveBrief, useRequestChanges } from '@/api/mutations/useApproveBrief';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Textarea } from '@/components/ui/Textarea';
import styles from './BriefDetail.module.css';

export function BriefDetail() {
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  useAuth(); // Ensure authenticated
  const { data: brief, isLoading, error } = useStudyBrief(studyPublicId || '');
  const approveBrief = useApproveBrief(studyPublicId || '');
  const requestChanges = useRequestChanges(studyPublicId || '');

  const [showChangesForm, setShowChangesForm] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState('');
  const [changesSubmitted, setChangesSubmitted] = useState(false);
  const [checklist, setChecklist] = useState({
    scope: false,
    timeline: false,
    participants: false,
    budget: false,
  });

  if (isLoading) return <Skeleton variant="card" count={2} />;
  if (error || !brief) return <ErrorState message="Could not load brief." />;

  const isPendingApproval = brief.brief_status === 'pending_approval';
  const isApproved = brief.brief_status === 'approved';
  const isChangesRequested = brief.brief_status === 'changes_requested';
  const hasCascadeContent = Object.values(brief.cascade_fields).some(Boolean);

  const allChecked = Object.values(checklist).every(Boolean);

  async function handleApprove() {
    await approveBrief.mutateAsync({ checklist_confirmed: true });
  }

  async function handleRequestChanges() {
    if (!changeFeedback.trim()) return;
    await requestChanges.mutateAsync({ comment: changeFeedback });
    setShowChangesForm(false);
    setChangeFeedback('');
    setChangesSubmitted(true);
  }

  return (
    <>
      <PageHeader
        title="Research Brief"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: brief.study.name, to: `/studies/${studyPublicId}` },
          { label: 'Brief' },
        ]}
        meta={<StatusBadge status={brief.brief_status || 'draft'} />}
      />

      {/* Approval banner */}
      {isPendingApproval && (
        <Alert variant="warning" title="Pending approval">
          This brief is waiting for stakeholder approval.
          {brief.brief_reviewer_display_name && (
            <> Reviewer: <strong>{brief.brief_reviewer_display_name}</strong></>
          )}
        </Alert>
      )}

      {isApproved && (
        <Alert variant="success" title="Brief approved">
          Approved{brief.brief_approved_at ? ` on ${new Date(brief.brief_approved_at).toLocaleDateString()}` : ''}.
          {' '}
          <Link to={`/studies/${studyPublicId}/plan/new`}>
            Create research plan →
          </Link>
        </Alert>
      )}

      {isChangesRequested && (
        <Alert variant="warning" title="Changes requested">
          {brief.brief_reviewer_display_name && (
            <p><strong>{brief.brief_reviewer_display_name}</strong> requested changes.</p>
          )}
          {brief.brief_change_feedback && (
            <p className={styles.feedbackText}>{brief.brief_change_feedback}</p>
          )}
          <div className={styles.reviseAction}>
            <Link to={`/studies/${studyPublicId}/brief/new`}>
              <Button>Revise brief</Button>
            </Link>
          </div>
        </Alert>
      )}

      {changesSubmitted && !isChangesRequested && (
        <Alert variant="success" title="Changes requested and sent to the researcher">
          Your feedback has been saved. The researcher will see it when they open the brief.
        </Alert>
      )}

      {/* Brief content */}
      <div className={styles.content}>
        {brief.brief_url && (
          <Card>
            <a
              href={brief.brief_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.docLink}
            >
              View full brief on GitHub ↗
            </a>
          </Card>
        )}

        {/* Cascade fields summary */}
        <Card>
          <h2 className={styles.sectionTitle}>Brief summary</h2>
          {hasCascadeContent ? (
            <dl className={styles.fieldList}>
              {brief.cascade_fields.research_objectives && (
                <>
                  <dt>Research objectives</dt>
                  <dd>{brief.cascade_fields.research_objectives}</dd>
                </>
              )}
              {brief.cascade_fields.research_questions && (
                <>
                  <dt>Research questions</dt>
                  <dd>{brief.cascade_fields.research_questions}</dd>
                </>
              )}
              {brief.cascade_fields.target_barriers && (
                <>
                  <dt>Target barriers</dt>
                  <dd>{brief.cascade_fields.target_barriers}</dd>
                </>
              )}
              {brief.cascade_fields.methodology_selection && (
                <>
                  <dt>Methodology</dt>
                  <dd>{brief.cascade_fields.methodology_selection}</dd>
                </>
              )}
              {brief.cascade_fields.participant_approach && (
                <>
                  <dt>Participant approach</dt>
                  <dd>{brief.cascade_fields.participant_approach}</dd>
                </>
              )}
              {brief.cascade_fields.start_date && (
                <>
                  <dt>Start date</dt>
                  <dd>{brief.cascade_fields.start_date}</dd>
                </>
              )}
              {brief.cascade_fields.budget && (
                <>
                  <dt>Budget</dt>
                  <dd>{brief.cascade_fields.budget}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className={styles.emptyNote}>
              Brief content will appear here after generation completes.
            </p>
          )}
        </Card>
      </div>

      {/* Approval decision bar */}
      {isPendingApproval && (
        <div className={styles.decisionBar}>
          <h3 className={styles.decisionTitle}>Review checklist</h3>

          <div className={styles.checklist}>
            {Object.entries(checklist).map(([key, checked]) => (
              <label key={key} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span>
                  {key === 'scope' && 'Scope and method are appropriate'}
                  {key === 'timeline' && 'Timeline and deadline are feasible'}
                  {key === 'participants' && 'Participant approach is sound'}
                  {key === 'budget' && 'Budget is reasonable (or not applicable)'}
                </span>
              </label>
            ))}
          </div>

          {!showChangesForm ? (
            <div className={styles.decisionActions}>
              <Button
                onClick={handleApprove}
                disabled={!allChecked}
                loading={approveBrief.isPending}
              >
                Approve brief
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowChangesForm(true)}
              >
                Request changes
              </Button>
            </div>
          ) : (
            <div className={styles.changesForm}>
              <Textarea
                label="What needs to change?"
                required
                value={changeFeedback}
                onChange={(e) => setChangeFeedback(e.target.value)}
              />
              <div className={styles.decisionActions}>
                <Button
                  onClick={handleRequestChanges}
                  variant="danger"
                  disabled={!changeFeedback.trim()}
                  loading={requestChanges.isPending}
                >
                  Submit feedback
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowChangesForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {allChecked && (
            <p className={styles.consequence}>
              Approval unlocks the research plan.
            </p>
          )}
        </div>
      )}
    </>
  );
}
