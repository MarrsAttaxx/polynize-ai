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
  { id: 'treatment_map', label: 'Treatment map', role: 'hybrid', built: false },
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
