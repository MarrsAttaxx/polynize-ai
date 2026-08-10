/**
 * The example capability map for /capability-mapping.
 *
 * ONE BOTTLENECK, NOT A COMPANY, and that is the argument rather than a convenience.
 * The thesis is explicit that capability mapping targets a specific operational
 * bottleneck first and scales from there, rather than attempting a top-down corporate
 * inventory. A map of a whole organisation on this page would contradict the sentence
 * three screens above it. So this is one bottleneck, broken into its clusters and its
 * capabilities, exactly as a real first engagement produces.
 *
 * The bottleneck is complex proposal writing, which is the worked example in the
 * source material, and it is the same process the matrix on /mapping tracks. That is
 * deliberate: a reader who lands on both pages should recognise one piece of work being
 * looked at two different ways.
 *
 * THE HUMAN LANE IS NOT LEFTOVERS. Every capability allocated to human has a `why` that
 * says what judgment is being protected. The output is a three way split and the human
 * column is treated with the same rigour as the other two, because the point is finding
 * where human judgment must stay, not only where execution can be offloaded.
 *
 * Illustrative. No client's real map is published here.
 */

export type Lane = 'human' | 'hybrid' | 'agentic';

export type MapCap = {
  /** Short stable id, shown in the row. */
  id: string;
  name: string;
  lane: Lane;
  /** One line on what the capability actually is. */
  detail: string;
  /** The work inside it. */
  tasks: string[];
  /** Why it sits in this lane and not another. The honest part of the map. */
  why: string;
};

export type MapCluster = { name: string; note: string; caps: MapCap[] };

export const MAP_CLUSTERS: MapCluster[] = [
  {
    name: 'Qualify',
    note: 'Deciding whether this is work worth bidding for.',
    caps: [
      {
        id: 'Q1',
        name: 'Opportunity research',
        lane: 'agentic',
        detail: 'Assembling everything knowable about the client, the buyer and the market before anyone spends time on a bid.',
        tasks: ['Pull the client history', 'Read the tender and the addenda', 'Assemble the market picture'],
        why: 'The inputs are public or already in your systems, and the work is retrieval. No judgment is lost by handing it over.',
      },
      {
        id: 'Q2',
        name: 'Bid or no bid',
        lane: 'human',
        detail: 'The call on whether to commit the team to this pursuit at all.',
        tasks: ['Weigh it against the pipeline', 'Judge the relationship', 'Decide what you are willing to lose'],
        why: 'This is a commitment of your people and your reputation. It is the decision the rest of the process depends on, and it stays with the person accountable for it.',
      },
      {
        id: 'Q3',
        name: 'Win theme',
        lane: 'hybrid',
        detail: 'The one argument the whole proposal has to make.',
        tasks: ['Draft candidate angles', 'Test them against what the client said', 'Choose and commit'],
        why: 'A model can generate the options quickly. Knowing which one this particular buyer will actually respond to is judgment, and it comes from the room.',
      },
    ],
  },
  {
    name: 'Build',
    note: 'Turning the decision into a document.',
    caps: [
      {
        id: 'B1',
        name: 'Content assembly',
        lane: 'agentic',
        detail: 'Finding and fitting the material that already exists somewhere in the business.',
        tasks: ['Locate prior responses', 'Reshape to this question', 'Flag what is missing'],
        why: 'Purely mechanical, and the thing that eats the most hours today. This is the capability with the largest gap between what it costs and what it is worth.',
      },
      {
        id: 'B2',
        name: 'Technical response',
        lane: 'hybrid',
        detail: 'The method, the approach and the evidence that you can actually do the work.',
        tasks: ['Draft the method', 'Pull the proof points', 'Have the practitioner correct it'],
        why: 'A draft in minutes rather than days, but a practitioner has to own the claim. Nobody signs a method statement they did not check.',
      },
      {
        id: 'B3',
        name: 'Commercial model',
        lane: 'human',
        detail: 'The price, the shape of the deal, and what you are prepared to carry.',
        tasks: ['Build the estimate', 'Test the assumptions', 'Set the risk position'],
        why: 'Every number here is a commitment somebody has to stand behind. A generated figure that nobody has interrogated is exactly how a business loses money on a win.',
      },
      {
        id: 'B4',
        name: 'Voice and consistency',
        lane: 'hybrid',
        detail: 'Making a document written by six people and a model sound like one firm.',
        tasks: ['Apply the house voice', 'Reconcile contradictions', 'Final read'],
        why: 'The pass is mechanical, the ear is not. Somebody still has to notice when it sounds like nobody.',
      },
    ],
  },
  {
    name: 'Close',
    note: 'Getting from document to decision.',
    caps: [
      {
        id: 'C1',
        name: 'Compliance check',
        lane: 'agentic',
        detail: 'Proving the submission answers every question in the form it was asked.',
        tasks: ['Match responses to requirements', 'Check limits and formats', 'Produce the matrix'],
        why: 'A rules check against a document. Machines are better at this than people are, and the cost of missing one is the whole bid.',
      },
      {
        id: 'C2',
        name: 'Client conversation',
        lane: 'human',
        detail: 'The meetings where the deal is actually won or lost.',
        tasks: ['Read the room', 'Handle the objection nobody prepared for', 'Build the relationship'],
        why: 'Nothing about this is a document. It is the part of the work that most obviously has to stay human, and mapping it says so out loud rather than leaving it unexamined.',
      },
      {
        id: 'C3',
        name: 'Post-decision capture',
        lane: 'hybrid',
        detail: 'Keeping what the pursuit taught you, whether you won or lost.',
        tasks: ['Debrief the team', 'Structure the lessons', 'File it so it is findable'],
        why: 'The capture can be automated. Deciding what actually mattered cannot, and this is the capability most often skipped, which is how institutional knowledge goes missing.',
      },
    ],
  },
];
