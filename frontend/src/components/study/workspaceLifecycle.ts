/**
 * Workspace Lifecycle Navigation — Presentation-only configuration.
 *
 * VC-2A: This defines the approved CD composition for the Workspace v2
 * lifecycle panel. It is NOT domain state — it describes the visual
 * navigation structure only.
 *
 * Source of truth: LIFECYCLE_NAV_CONVERGENCE.md §4
 *
 * - Only Research Brief and Research Plan are real routes
 * - All other items are presentation-only placeholders
 * - Plan lock state comes from computeLifecycleNodes (not from this config)
 */

export type WorkspaceNavItem =
  | { label: string; kind: 'route'; stage: 'brief' | 'plan' }
  | { label: string; kind: 'placeholder' };

export interface WorkspaceLifecycleGroup {
  group: string;
  items: WorkspaceNavItem[];
}

/**
 * Exact CD composition: 5 groups, 15 items.
 * Labels and ordering are verbatim from the approved design.
 */
export const WORKSPACE_LIFECYCLE: WorkspaceLifecycleGroup[] = [
  {
    group: 'Discovery',
    items: [
      { label: 'Desk Research', kind: 'placeholder' },
      { label: 'Stakeholders', kind: 'placeholder' },
      { label: 'Surveys', kind: 'placeholder' },
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
