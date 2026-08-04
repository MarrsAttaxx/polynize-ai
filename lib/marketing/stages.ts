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
    // PRE-RECORD (D31): the PREZIE the touchscreen runs. It must exist before the
    // shoot because the presenter operates it live on camera, so it is a prop rather
    // than post-production. Distinct from the post-record `treatment` stage below
    // (overlays/execution on the footage).
    //
    // The stage id stays `treatment_map` through every rename of this stage
    // (treatment -> screen prompt -> interface -> prezie): display-only, so no piece
    // already in flight is orphaned. "Prezie" is Marrs's own word for it, which is the
    // best reason to use it: it is what he calls the thing when he is not thinking about
    // the console.
    id: 'treatment_map',
    label: 'Prezie',
    role: 'hybrid',
    built: true,
    href: (id) => `/console/marketing/piece/${id}/prezie`,
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
