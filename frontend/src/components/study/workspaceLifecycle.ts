/**
 * Workspace Lifecycle Navigation — Presentation-only configuration.
 *
 * VC-2A: This defines the approved CD composition for the Workspace v2
 * lifecycle panel. It is NOT domain state — it describes the visual
 * navigation structure only.
 *
 * Source of truth: LIFECYCLE_NAV_CONVERGENCE.md §4
 * NAV-1b: Discovery group has 5 rows: Overview, Desk research,
 * Stakeholders, Surveys (all routes), and Synthesis (placeholder until DISC-5).
 *
 * - Discovery rows use path-based routes (not query params)
 * - Plan lock state comes from computeLifecycleNodes (not from this config)
 * - Synthesis is a placeholder until DISC-5
 */

/** Discovery type keys matching backend DiscoveryTypeKey */
export type DiscoveryTypeFilter = 'desk' | 'stakeholder' | 'survey';

export type WorkspaceNavItem =
  | { label: string; kind: 'route'; stage: 'brief' | 'plan' }
  | {
      label: string;
      kind: 'discovery-route';
      /** Route path relative to /studies/:id/discovery */
      path: string;
      /** Filter type for counting artifacts (null = all) */
      filterType: DiscoveryTypeFilter | null;
    }
  | { label: string; kind: 'placeholder' };

export interface WorkspaceLifecycleGroup {
  group: string;
  items: WorkspaceNavItem[];
}

/**
 * NAV-1b CD composition: 5 groups, 16 items.
 * Discovery group has 5 rows per STUDY_WORKSPACE_NAV_CORRECTION.md.
 * Routes are path-based, not query-param based.
 */
export const WORKSPACE_LIFECYCLE: WorkspaceLifecycleGroup[] = [
  {
    group: 'Discovery',
    items: [
      { label: 'Overview', kind: 'discovery-route', path: '', filterType: null },
      { label: 'Desk research', kind: 'discovery-route', path: '/desk', filterType: 'desk' },
      { label: 'Stakeholders', kind: 'discovery-route', path: '/stakeholders', filterType: 'stakeholder' },
      { label: 'Surveys', kind: 'discovery-route', path: '/surveys', filterType: 'survey' },
      { label: 'Synthesis', kind: 'placeholder' }, // DISC-5
    ],
  },
  {
    group: 'Planning',
    items: [
      { label: 'Research Brief', kind: 'route', stage: 'brief' },
      { label: 'Research Plan', kind: 'route', stage: 'plan' },
      { label: 'Discussion Guide', kind: 'placeholder' },
    ],
  },
  {
    group: 'Fieldwork',
    items: [
      { label: 'Outreach', kind: 'placeholder' },
      { label: 'Participants', kind: 'placeholder' },
      { label: 'Sessions', kind: 'placeholder' },
      { label: 'Observers', kind: 'placeholder' },
    ],
  },
  {
    group: 'Analysis',
    items: [
      { label: 'Session Analysis', kind: 'placeholder' },
      { label: 'Affinity & Themes', kind: 'placeholder' },
    ],
  },
  {
    group: 'Outputs',
    items: [
      { label: 'Design Opportunities', kind: 'placeholder' },
      { label: 'Readouts', kind: 'placeholder' },
      { label: 'Tickets', kind: 'placeholder' },
    ],
  },
];
