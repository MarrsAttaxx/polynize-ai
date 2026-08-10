/**
 * Example capability maps, one per team, for /capability-mapping.
 *
 * A TEAM, NOT A BOTTLENECK. The earlier version mapped a single proposal-writing
 * bottleneck, which matched the thesis but not what a reader wants to see on the page:
 * they want to find their own team in an org chart and watch it get mapped. So every
 * entry here is a whole function broken into the clusters it is actually made of.
 *
 * GENERALISED ON PURPOSE. These are the capabilities any medium to large business has in
 * that function, not any client's. A reader should recognise their own team in one of
 * them within a couple of seconds, which is the entire job of this section.
 *
 * THE HUMAN LANE IS NOT LEFTOVERS. Every capability allocated to human carries a `why`
 * that names the judgment being protected. The output is a three-way split and the human
 * column gets the same rigour as the other two, because the point is finding where
 * judgment must stay, not only where execution can be offloaded. A map where human is
 * the smallest column by default would be arguing the opposite.
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

export type TeamId =
  | 'leadership'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'operations'
  | 'people'
  | 'product';

export type Team = {
  id: TeamId;
  /** Shown in the org chart and in the map heading. */
  name: string;
  /** One line under the name in the org chart. */
  note: string;
  /** Where it sits in the chart: the top row, or the function row beneath it. */
  tier: 'lead' | 'function';
  clusters: MapCluster[];
};

const cap = (
  id: string,
  name: string,
  lane: Lane,
  detail: string,
  tasks: string[],
  why: string
): MapCap => ({ id, name, lane, detail, tasks, why });

export const TEAMS: Team[] = [
  {
    id: 'leadership',
    name: 'Leadership',
    note: 'Strategy, capital, and the calls nobody else can make',
    tier: 'lead',
    clusters: [
      {
        name: 'Decide',
        note: 'Where the business is going and what it will spend to get there.',
        caps: [
          cap('L1', 'Market sensing', 'agentic', 'Knowing what is happening outside the building before it arrives inside it.', ['Track competitors and category', 'Digest analyst and market data', 'Surface what changed this week'], 'Continuous retrieval across sources nobody has time to read. Handing it over buys back the reading, not the thinking.'),
          cap('L2', 'Strategic choice', 'human', 'Deciding what the business will and will not do.', ['Weigh the options', 'Commit capital', 'Own the consequence'], 'Somebody has to be accountable for a decision that cannot be unwound cheaply. A model can lay out the options; it cannot carry the outcome.'),
          cap('L3', 'Scenario modelling', 'hybrid', 'Testing a decision against futures that have not happened yet.', ['Build the cases', 'Stress the assumptions', 'Judge which case is credible'], 'The arithmetic is fast and mechanical. Deciding which scenario is plausible is judgment about your market, and that stays.'),
        ],
      },
      {
        name: 'Align',
        note: 'Getting an organisation to move in one direction.',
        caps: [
          cap('L4', 'Narrative setting', 'hybrid', 'The story of where the company is going, told so people act on it.', ['Draft the message', 'Test it on real audiences', 'Deliver it in person'], 'A draft in minutes, but a leader who reads out a generated speech is heard doing exactly that. The delivery is the capability.'),
          cap('L5', 'Board and investor relations', 'human', 'The relationships that decide whether you get the next round of support.', ['Prepare the position', 'Handle the hard question', 'Hold the relationship'], 'Trust is built by a person over years. Nothing about this is a document, which is why it is the clearest human column on the map.'),
          cap('L6', 'Reporting pack assembly', 'agentic', 'Turning the month into something a board can read.', ['Pull the numbers', 'Build the pack', 'Flag the variances'], 'Assembly against a fixed format. The commentary is judgment; producing the pack is not, and it eats a week every month.'),
        ],
      },
      {
        name: 'Govern',
        note: 'Making sure the organisation does what it said it would.',
        caps: [
          cap('L7', 'Risk oversight', 'hybrid', 'Knowing which exposures are real and which are noise.', ['Maintain the register', 'Score and rank', 'Decide what to accept'], 'Detection and tracking scale well. Deciding what risk the business is willing to carry is a leadership decision with a name attached.'),
          cap('L8', 'Performance review', 'hybrid', 'Reading whether the plan is actually working.', ['Assemble the evidence', 'Spot the divergence', 'Call the correction'], 'The reading is automatable and the correction is not. Most organisations do the first badly and the second late.'),
          cap('L9', 'Succession and bench', 'human', 'Knowing who could do the job next, and who is not ready.', ['Assess the bench', 'Have the honest conversation', 'Make the call'], 'A judgment about people that carries a career on the end of it. This one should never leave the room.'),
        ],
      },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    note: 'Pipeline, pursuit and the close',
    tier: 'function',
    clusters: [
      {
        name: 'Find',
        note: 'Turning a market into a pipeline.',
        caps: [
          cap('S1', 'Account research', 'agentic', 'Everything knowable about a buyer before anyone spends time on them.', ['Pull the account history', 'Read the market signals', 'Assemble the brief'], 'Retrieval from public and internal sources. No judgment is lost by handing it over, and it is the single largest time sink in the function.'),
          cap('S2', 'Qualification', 'hybrid', 'Deciding which opportunities deserve the team.', ['Score against the criteria', 'Check the signals', 'Make the call'], 'Scoring is mechanical. Knowing that a well-scoring account is actually a time sink is pattern recognition from having been burned.'),
          cap('S3', 'Outreach', 'hybrid', 'Getting a first conversation with someone who does not know you.', ['Draft the approach', 'Personalise it properly', 'Send and follow up'], 'Generation is instant and generic outreach is worse than none. The capability is knowing what would actually make this person reply.'),
        ],
      },
      {
        name: 'Pursue',
        note: 'From first conversation to a proposal on the table.',
        caps: [
          cap('S4', 'Discovery', 'human', 'Finding out what the client actually needs, including what they have not said.', ['Ask the question behind the question', 'Read the room', 'Map the buying group'], 'The whole capability is noticing what is not being said. That is not a transcript problem, it is a presence problem.'),
          cap('S5', 'Proposal build', 'agentic', 'Assembling a document from material that already exists.', ['Locate prior responses', 'Reshape to this client', 'Flag what is missing'], 'Mechanical assembly, and the thing that most often keeps good people at their desks until eight.'),
          cap('S6', 'Commercial structuring', 'human', 'The price, the terms and what you are prepared to carry.', ['Build the position', 'Test the assumptions', 'Set the risk'], 'Every number is a commitment somebody stands behind. A generated figure nobody interrogated is how a business loses money on a win.'),
        ],
      },
      {
        name: 'Close',
        note: 'Getting to signature and keeping what you learned.',
        caps: [
          cap('S7', 'Negotiation', 'human', 'The conversation where the deal is actually decided.', ['Hold the position', 'Trade the right things', 'Know when to walk'], 'Real-time judgment under pressure with a relationship on the line. Nothing here is a document.'),
          cap('S8', 'Forecasting', 'hybrid', 'Saying what will land this quarter and being right.', ['Read the pipeline data', 'Weight by stage and history', 'Apply what you know'], 'The maths is better done by a machine. The adjustment for what you know about a particular deal is why forecasts are ever accurate.'),
          cap('S9', 'Handover to delivery', 'agentic', 'Making sure the team who delivers knows what was sold.', ['Capture the commitments', 'Structure the brief', 'File it where delivery looks'], 'Structured transfer of things already agreed. Skipping it is the most common cause of a good sale becoming a bad project.'),
        ],
      },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    note: 'Demand, brand and the message',
    tier: 'function',
    clusters: [
      {
        name: 'Position',
        note: 'Deciding what you are saying and to whom.',
        caps: [
          cap('M1', 'Audience research', 'agentic', 'Understanding who buys and what moves them.', ['Gather the signals', 'Cluster the segments', 'Summarise the picture'], 'Volume work across sources. The synthesis is fast and reliable, and it is what most teams skip for lack of time.'),
          cap('M2', 'Positioning', 'human', 'The claim the whole company stands behind.', ['Choose the ground', 'Test it with real buyers', 'Commit'], 'A bet on how you want to be understood, made once and lived with for years. This is not a generation problem.'),
          cap('M3', 'Message testing', 'hybrid', 'Finding out whether the claim actually lands.', ['Generate variants', 'Run them past real people', 'Read what happened'], 'Variants are cheap now. Interpreting a lukewarm response correctly is the part that decides whether you change the words or the offer.'),
        ],
      },
      {
        name: 'Produce',
        note: 'Turning the message into things people see.',
        caps: [
          cap('M4', 'Content production', 'agentic', 'Getting the volume out at a consistent standard.', ['Draft to brief', 'Adapt per channel', 'Schedule and ship'], 'The clearest automation case in the function, and the one that most obviously needs the brand voice capability sitting beside it.'),
          cap('M5', 'Brand voice', 'hybrid', 'Making everything sound like one company.', ['Apply the voice', 'Catch what is off', 'Correct the drift'], 'The pass is mechanical, the ear is not. Somebody has to notice when the output has started sounding like nobody in particular.'),
          cap('M6', 'Creative direction', 'human', 'Deciding what the work should feel like.', ['Set the direction', 'Judge the options', 'Kill what is not working'], 'Taste, and taste applied to a specific audience. The most common failure is a team generating a hundred options with nobody able to choose.'),
        ],
      },
      {
        name: 'Measure',
        note: 'Knowing what any of it did.',
        caps: [
          cap('M7', 'Performance reporting', 'agentic', 'What ran, what it cost, what came back.', ['Pull the channel data', 'Reconcile the sources', 'Build the view'], 'Reconciliation across platforms that do not agree with each other. Tedious, exacting, and perfectly suited to being handed over.'),
          cap('M8', 'Attribution judgment', 'hybrid', 'Deciding what actually caused the result.', ['Model the paths', 'Sanity check against reality', 'Decide what to believe'], 'Every attribution model is wrong in a different way. Knowing which one is wrong in a way you can live with is judgment.'),
          cap('M9', 'Budget allocation', 'human', 'Where the next dollar goes.', ['Weigh the evidence', 'Back a channel', 'Defend the call'], 'A commitment with a name on it, made on incomplete evidence. Exactly the decision the rest of the map exists to inform.'),
        ],
      },
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    note: 'Control, reporting and capital',
    tier: 'function',
    clusters: [
      {
        name: 'Record',
        note: 'Getting the numbers right in the first place.',
        caps: [
          cap('F1', 'Transaction processing', 'agentic', 'Everything that happens the same way every time.', ['Code and post', 'Match and reconcile', 'Flag the exceptions'], 'Rules applied at volume. Machines are simply better at this than people, and the exception queue is where the humans should be.'),
          cap('F2', 'Reconciliation', 'agentic', 'Making the sources agree.', ['Compare the ledgers', 'Chase the differences', 'Clear the breaks'], 'Exact, repetitive, and unforgiving of tiredness. The classic case for offloading.'),
          cap('F3', 'Exception handling', 'hybrid', 'Dealing with the things that did not fit the rules.', ['Triage the queue', 'Investigate the odd ones', 'Decide the treatment'], 'Triage sorts itself; the odd ones need somebody who knows the business to work out what actually happened.'),
        ],
      },
      {
        name: 'Explain',
        note: 'Turning numbers into something a decision can be made on.',
        caps: [
          cap('F4', 'Management reporting', 'agentic', 'The monthly pack, on time and consistent.', ['Assemble the numbers', 'Build the views', 'Distribute'], 'Assembly against a fixed format. It should not consume the first week of every month, and in most organisations it does.'),
          cap('F5', 'Variance analysis', 'hybrid', 'Explaining why the number is not the number you expected.', ['Identify the gaps', 'Trace the causes', 'Judge what matters'], 'Finding the variance is arithmetic. Knowing which of six explanations is the real one requires knowing the business.'),
          cap('F6', 'Commercial partnering', 'human', 'Sitting with the business and changing what it decides.', ['Challenge the plan', 'Model the alternative', 'Influence the call'], 'Persuading an operating leader to change course is a relationship capability, and it is what separates a finance team from a reporting team.'),
        ],
      },
      {
        name: 'Protect',
        note: 'Keeping the business solvent and out of trouble.',
        caps: [
          cap('F7', 'Cash forecasting', 'hybrid', 'Knowing what the bank balance will be.', ['Model the inflows', 'Read the payment behaviour', 'Adjust for what you know'], 'The model runs itself. The adjustment for a customer who always pays late is knowledge that lives in somebody’s head.'),
          cap('F8', 'Compliance and controls', 'agentic', 'Proving you did what you said you do.', ['Test the controls', 'Evidence the trail', 'Report the exceptions'], 'A rules check against a record. Machines do not get bored on the four hundredth sample, which is precisely when people miss things.'),
          cap('F9', 'Capital decisions', 'human', 'What the business invests in and what it does not.', ['Weigh the cases', 'Judge the risk', 'Commit the funds'], 'The decision the whole function exists to support, and the one that must stay with a person who can be held to it.'),
        ],
      },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    note: 'Delivery, service and the running of the thing',
    tier: 'function',
    clusters: [
      {
        name: 'Plan',
        note: 'Deciding what gets done, by whom, when.',
        caps: [
          cap('O1', 'Demand planning', 'hybrid', 'Knowing how much work is coming.', ['Model the demand', 'Read the leading signals', 'Set the plan'], 'Forecasting is a solved arithmetic problem. Knowing that the forecast is about to be wrong because of something happening in the market is not.'),
          cap('O2', 'Scheduling', 'agentic', 'Fitting the work to the capacity.', ['Build the schedule', 'Resolve the clashes', 'Republish on change'], 'Constraint solving at a scale and speed that a person with a spreadsheet cannot match, and it changes every day.'),
          cap('O3', 'Resource decisions', 'human', 'Who does what, and who is stretched too thin.', ['Weigh the people', 'Make the trade', 'Own the consequence'], 'Allocating people is a judgment about people. The schedule can be optimal and still be wrong for the person in it.'),
        ],
      },
      {
        name: 'Run',
        note: 'Getting the work through the door.',
        caps: [
          cap('O4', 'Process execution', 'agentic', 'The steps that happen the same way every time.', ['Run the steps', 'Route the work', 'Escalate what stalls'], 'Repetition at volume. This is where most of the hours are and where almost none of the judgment is.'),
          cap('O5', 'Exception resolution', 'hybrid', 'Handling the jobs that went off the path.', ['Detect the exception', 'Diagnose it', 'Decide the fix'], 'Detection scales; diagnosis often needs somebody who has seen this fail before and knows which shortcut is safe.'),
          cap('O6', 'Quality judgment', 'human', 'Deciding whether the work is actually good enough to go out.', ['Inspect the output', 'Weigh the trade-off', 'Sign it off'], 'Somebody puts their name to it. A check against a rubric is not the same as knowing this particular client will not accept it.'),
        ],
      },
      {
        name: 'Improve',
        note: 'Making next month better than this one.',
        caps: [
          cap('O7', 'Performance monitoring', 'agentic', 'Knowing what the operation is actually doing.', ['Instrument the flow', 'Track the measures', 'Alert on drift'], 'Continuous measurement, which people do in bursts and machines do constantly. Most teams find out too late.'),
          cap('O8', 'Root cause analysis', 'hybrid', 'Finding out why something keeps going wrong.', ['Assemble the evidence', 'Test the hypotheses', 'Name the cause'], 'The evidence gathering is mechanical. Distinguishing the cause from the three things correlated with it is experience.'),
          cap('O9', 'Change management', 'human', 'Getting people to actually work the new way.', ['Bring people with you', 'Handle the resistance', 'Make it stick'], 'A process change that nobody adopts is not a change. This is the capability most often assumed and least often resourced.'),
        ],
      },
    ],
  },
  {
    id: 'people',
    name: 'People',
    note: 'Hiring, capability and culture',
    tier: 'function',
    clusters: [
      {
        name: 'Attract',
        note: 'Getting the right people through the door.',
        caps: [
          cap('P1', 'Sourcing', 'agentic', 'Finding candidates who could actually do the job.', ['Search the market', 'Screen against criteria', 'Build the shortlist'], 'Search and filter at volume. It also removes a well-documented source of inconsistency in who gets looked at.'),
          cap('P2', 'Assessment design', 'hybrid', 'Working out how you will tell whether someone is good.', ['Define what good looks like', 'Build the exercise', 'Calibrate the scoring'], 'Drafting is quick. Knowing what good looks like in your business is the part that makes the assessment worth running.'),
          cap('P3', 'Hiring decisions', 'human', 'Choosing who joins.', ['Weigh the evidence', 'Judge the fit', 'Make the offer'], 'A decision about a person that changes their life and your team. It stays with the people accountable for both.'),
        ],
      },
      {
        name: 'Develop',
        note: 'Making the people you have better at the work.',
        caps: [
          cap('P4', 'Capability mapping', 'hybrid', 'Knowing what your people can actually do.', ['Model the work', 'Assess against it', 'Benchmark the result'], 'The measurement scales and the interpretation does not. It is also the capability that makes every other decision in this function defensible.'),
          cap('P5', 'Learning design', 'agentic', 'Building the material that closes a known gap.', ['Draft the content', 'Adapt to the role', 'Keep it current'], 'Production against a defined gap. The gap has to be real first, which is what P4 is for.'),
          cap('P6', 'Coaching', 'human', 'Sitting with somebody and helping them get better.', ['Observe the work', 'Give the hard feedback', 'Follow through'], 'A relationship over time in which somebody is willing to be told they are not good at something yet. That requires trust in a person.'),
        ],
      },
      {
        name: 'Sustain',
        note: 'Keeping the organisation working as a place to work.',
        caps: [
          cap('P7', 'Workforce analytics', 'agentic', 'Knowing what is happening to your people at scale.', ['Assemble the data', 'Track the movements', 'Surface the patterns'], 'Aggregation across systems that do not talk to each other. The pattern is usually visible months before anybody notices it.'),
          cap('P8', 'Policy and compliance', 'hybrid', 'Keeping the rules current and applied.', ['Draft and update', 'Check for conflicts', 'Decide the interpretation'], 'Drafting and conflict checking are mechanical. How a policy applies to an awkward real case is a judgment somebody signs.'),
          cap('P9', 'Difficult conversations', 'human', 'Performance, conduct, and exits.', ['Prepare properly', 'Hold the conversation', 'Carry the aftermath'], 'The highest-stakes human capability in any organisation, and the one where an automated shortcut does the most damage.'),
        ],
      },
    ],
  },
  {
    id: 'product',
    name: 'Product & Engineering',
    note: 'What gets built and whether it works',
    tier: 'function',
    clusters: [
      {
        name: 'Decide',
        note: 'Choosing what is worth building.',
        caps: [
          cap('E1', 'Signal gathering', 'agentic', 'Everything customers and the market are telling you.', ['Aggregate the feedback', 'Cluster the themes', 'Rank by frequency'], 'Volume synthesis across tickets, calls and reviews. Nobody reads all of it, which means everybody argues from the loudest example.'),
          cap('E2', 'Prioritisation', 'human', 'Deciding what gets built and what waits.', ['Weigh the evidence', 'Make the trade', 'Say no'], 'Saying no to a credible request from a real customer is a judgment with consequences. It cannot be delegated to a score.'),
          cap('E3', 'Specification', 'hybrid', 'Describing the thing precisely enough to build.', ['Draft the spec', 'Surface the edge cases', 'Resolve the ambiguity'], 'Drafting and edge-case generation are fast and genuinely useful. Deciding the ambiguous case is a product decision.'),
        ],
      },
      {
        name: 'Build',
        note: 'Getting it made.',
        caps: [
          cap('E4', 'Implementation', 'hybrid', 'Writing the thing.', ['Generate the first pass', 'Review and correct', 'Integrate'], 'The single most changed capability in this list. A first pass in minutes, and an engineer who owns every line that ships.'),
          cap('E5', 'Testing', 'agentic', 'Proving it does what the spec said.', ['Generate the cases', 'Run the suite', 'Report the failures'], 'Coverage at a scale nobody writes by hand. The judgment is in what to test, not in the running of it.'),
          cap('E6', 'Architecture', 'human', 'Decisions that are expensive to reverse.', ['Weigh the approaches', 'Choose the constraints', 'Live with it'], 'A choice the organisation will be paying for in three years. It stays with the people who will still be there.'),
        ],
      },
      {
        name: 'Operate',
        note: 'Keeping it alive once real people depend on it.',
        caps: [
          cap('E7', 'Monitoring', 'agentic', 'Knowing something is wrong before a customer tells you.', ['Instrument the system', 'Watch the signals', 'Alert on anomaly'], 'Continuous attention, which is the thing people are worst at and machines are best at.'),
          cap('E8', 'Incident response', 'hybrid', 'Getting it working again.', ['Triage and diagnose', 'Apply the fix', 'Decide the trade-off'], 'Diagnosis is increasingly assisted. Deciding to accept a risky fix at two in the morning is a person with authority.'),
          cap('E9', 'Technical debt calls', 'human', 'Deciding what to leave broken for now.', ['Assess the cost', 'Weigh against delivery', 'Choose'], 'A judgment about the future of the codebase against the pressure of the quarter. Nobody has automated that and nobody should.'),
        ],
      },
    ],
  },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<TeamId, Team>;
