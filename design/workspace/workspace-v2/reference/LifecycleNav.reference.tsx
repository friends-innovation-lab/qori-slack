/**
 * DESIGN REFERENCE — NOT PRODUCTION
 * Target markup for LifecycleRail variant="inverse" (frontend/src/components/study/LifecycleRail.tsx).
 * Uses the production LifecycleNode contract (@qori/api-contracts) and production stageRoutes verbatim.
 * The prototype's Discovery/Planning/Fieldwork grouping is NOT used — production stages are the contract.
 * Spec: COMPONENT_MAPPING.md §3.3.
 */
import { Lock, AlertTriangle, ArrowRight, Circle } from 'lucide-react';
import type { LifecycleNode } from '@qori/api-contracts';
import './workspace-v2.reference.css';

const stateIcons = { locked: Lock, readiness_warning: AlertTriangle, suggested: ArrowRight, free: Circle, current: Circle };
const stageRoutes: Record<string, string> = { overview: '', brief: '/brief', plan: '/plan', sources: '/sources', evidence: '/evidence', findings: '/findings', outputs: '/outputs' };

/** Sample = output of computeLifecycleNodes('approved') with the route on Plan. Illustration only. */
export const sampleNodes: LifecycleNode[] = [
  { stage: 'overview', label: 'Overview', state: 'current', unlock_hint: null, count: 0, is_current: true },
  { stage: 'brief', label: 'Brief', state: 'free', unlock_hint: null, count: 1, is_current: false },
  { stage: 'plan', label: 'Plan', state: 'suggested', unlock_hint: null, count: 0, is_current: false },
  { stage: 'sources', label: 'Sources', state: 'locked', unlock_hint: 'Add sources after plan', count: 0, is_current: false },
  { stage: 'evidence', label: 'Evidence', state: 'locked', unlock_hint: 'Analyze sessions first', count: 0, is_current: false },
  { stage: 'findings', label: 'Findings', state: 'locked', unlock_hint: 'Run synthesis first', count: 0, is_current: false },
  { stage: 'outputs', label: 'Outputs', state: 'locked', unlock_hint: 'Generate readout first', count: 0, is_current: false },
];

interface Props {
  studyPublicId: string;
  nodes: LifecycleNode[];
  activeStage: string; // production derives from NavLink isActive — shown explicitly here
  study: { name: string; backTo: string; backLabel: string; orgName?: string };
}

export function LifecycleNavReference({ studyPublicId, nodes, activeStage, study }: Props) {
  return (
    {/* production module class: styles.rail + styles.railInverse (CSS Modules scope it; the global reference CSS only needs railInverse) */}
    <nav className="railInverse" aria-label="Study lifecycle">
      <div className="studyHead">
        <p className="studyEyebrow">{study.orgName ?? 'Study'}</p>
        <p className="studyName">{study.name}</p>
        <a className="studyBack" href={study.backTo}>← {study.backLabel}</a>
      </div>
      <ul className="list">
        {nodes.map((node) => {
          const Icon = stateIcons[node.state] || Circle;
          const route = stageRoutes[node.stage] ?? '';
          const isLocked = node.state === 'locked';
          const isActive = node.stage === activeStage;
          const ariaCurrent = isActive ? 'page' : node.is_current ? 'step' : undefined;
          return (
            <li key={node.stage} className="item">
              <a
                href={`/studies/${studyPublicId}${route}`}
                className={`node ${node.state}${isActive ? ' active' : ''}`}
                aria-current={ariaCurrent}
                aria-disabled={isLocked || undefined}
                aria-label={`${node.label}${node.count > 0 ? `, ${node.count} items` : ''}${isLocked ? `, locked: ${node.unlock_hint}` : ''}`}
                onClick={(e) => { if (isLocked) e.preventDefault(); }}
              >
                <Icon size={16} className="icon" aria-hidden="true" />
                <span className="label" style={{ flex: 1 }}>{node.label}</span>
                {node.count > 0 && <span className="count">{node.count}</span>}
              </a>
              {isLocked && node.unlock_hint && <span className="hint" aria-hidden="true">{node.unlock_hint}</span>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Visual states to verify (one row each): locked · readiness_warning · suggested · free · current · active route · hover · focus-visible (inverse ring). */
export function LifecycleNavStatesReference() {
  return (
    <div style={{ display: 'flex', height: 560 }}>
      <LifecycleNavReference
        studyPublicId="st_123"
        nodes={sampleNodes}
        activeStage="plan"
        study={{ name: 'Permit Application Status Experience', backTo: '/projects', backLabel: 'All projects', orgName: 'City of Example' }}
      />
    </div>
  );
}
