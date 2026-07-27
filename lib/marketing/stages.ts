/**
 * The middle-module stages for short-form video (the swappable middle of the
 * production spine). One source of truth for the stage rail so the pipeline reads
 * as a spine and every future stage (Mikey's) has a defined home + role.
 *
 * `built` = a screen exists today; the rest are placeholders shown as "soon" until
 * their stage (and its agent/integration) lands. Roles match the flow diagram:
 * human (coral) / hybrid (amber) / agent (mint).
 */
export type StageRole = 'human' | 'hybrid' | 'agent';

export type MiddleStage = {
  id: string;
  label: string;
  role: StageRole;
  built: boolean;
  /** Route for a built stage, relative to the piece. */
  href?: (pieceId: string) => string;
};

export const SHORT_FORM_STAGES: MiddleStage[] = [
  {
    id: 'script',
    label: 'Script',
    role: 'hybrid',
    built: true,
    href: (id) => `/console/marketing/piece/${id}`,
  },
  {
    // PRE-RECORD (D29 amended): the screen plan that must be BUILT before the shoot,
    // because the presenter touches it live on camera. Distinct from the post-record
    // `treatment` stage below (overlays/execution on the footage).
    id: 'treatment_map',
    label: 'Treatment',
    role: 'hybrid',
    built: true,
    href: (id) => `/console/marketing/piece/${id}/treatment`,
  },
  {
    id: 'record',
    label: 'Record',
    role: 'human',
    built: true,
    href: (id) => `/console/marketing/piece/${id}/teleprompter`,
  },
  { id: 'rough_cut', label: 'Rough cut', role: 'agent', built: false },
  { id: 'refine', label: 'Refine', role: 'human', built: false },
  { id: 'treatment', label: 'Treatment', role: 'agent', built: false },
  { id: 'captions', label: 'Captions', role: 'agent', built: false },
  { id: 'approve', label: 'Approve', role: 'human', built: false },
];
