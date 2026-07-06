/**
 * Interim agent provider — the OpenRouter stand-in (D1 interim runtime).
 *
 * Satisfies the AgentProvider seam using the console's own LLM layer, so the
 * intake interview -> concept-doc flow is fully working and testable BEFORE the
 * real April is provisioned. When the real (pull-worker) April lands, a new
 * provider registers in socket.ts and this one is no longer selected — no screen
 * or route change (docs/pam-console/agent-socket-contract.md).
 *
 * For jobs, the interim provider does the work INLINE inside submitJob and flips
 * the job to done, so jobStatus resolves immediately. The real April will instead
 * leave the job `queued` for its pull worker; the console/client code is identical.
 *
 * Server-side only.
 */

import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';
import { createJob, getJob, updateJob } from './jobs-store';
import { saveConcept } from '@/lib/marketing/concept-store';
import type {
  AgentProvider,
  ConverseRequest,
  ConverseResult,
  JobView,
  SubmitJobRequest,
} from './socket';

type ConceptFinalizeInput = {
  owner: string;
  stream: string;
  framing: string;
  transcript: { role: 'user' | 'assistant'; content: string }[];
  brandVoice?: string;
};

function interviewerSystemPrompt(brandVoice?: string): string {
  return `You are April, Polynize's concept interviewer. You are talking to a business owner or operator inside the Polynize console to draw out ONE sharp content concept.

How you work:
- Ask ONE or at most TWO questions per turn. This is a conversation, not a form.
- Go for the sharp, contrarian core: what does this person believe that the market does not, and why does it matter now. Chase the specific over the general.
- Draw out: the core thesis, who it is for, the one thing that makes it true, a concrete proof or story, and where it should land the viewer.
- Reflect their own words back so they know you are listening. Build on their last answer.
- When you have enough to write a strong concept, say so plainly and tell them they can create the concept doc.

Voice (Polynize):
- Direct, warm, concrete. No hype, no filler, no corporate throat-clearing.
- Short sentences. No emoji. No hashtags.
- Never use em-dashes. Use commas, periods, or colons.
${brandVoice ? `\nThe owner's personal brand voice (match this register):\n${brandVoice}` : ''}`;
}

function finalizeSystemPrompt(brandVoice?: string): string {
  return `You are April, Polynize's concept writer. From the interview transcript below, write a single concept doc in Markdown. This doc is the source of truth the rest of the pipeline (format variations, scripts) will draft from, so make it specific and usable, not generic.

Output ONLY the Markdown body, with exactly these sections and headings:

## Framing
One line: the sharp, contrarian angle in the owner's own framing.

## Core thesis
Two to four sentences. The argument, stated plainly.

## Who it is for
Who feels this, and the moment they feel it.

## Key beats
A short ordered list of the beats the argument moves through (this is what scripts will expand).

## Proof or story
The concrete thing that makes it land: a stat, an example, a story. If the interview did not surface one, say what is still needed rather than inventing it.

## Where it lands
The shift in the viewer, and the direction of the call to action.

## Source voice
One or two notes on the register and phrases to preserve.

Rules:
- Ground everything in the transcript. Do not fabricate specifics; if something is missing, name the gap.
- Polynize voice: direct, concrete, no hype, no emoji, no hashtags.
- Never use em-dashes. Use commas, periods, or colons.
${brandVoice ? `\nThe owner's personal brand voice (match this register):\n${brandVoice}` : ''}`;
}

function isFinalizeInput(x: unknown): x is ConceptFinalizeInput {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  return (
    typeof i.owner === 'string' &&
    typeof i.stream === 'string' &&
    typeof i.framing === 'string' &&
    Array.isArray(i.transcript)
  );
}

async function converse(req: ConverseRequest): Promise<ConverseResult> {
  const reply = await complete({
    system: interviewerSystemPrompt(req.systemContext?.brandVoice),
    messages: [...req.history, { role: 'user', content: req.message }],
    maxTokens: 700,
    temperature: 0.7,
    json: false, // April speaks prose, not JSON
  });
  return { reply: stripEmDashes(reply.trim()) };
}

async function submitJob(req: SubmitJobRequest): Promise<{ jobId: string }> {
  const job = await createJob(req.owner, req.jobType, req.input);

  if (req.jobType !== 'concept_finalize' || !isFinalizeInput(req.input)) {
    await updateJob(req.owner, job.job_id, {
      status: 'failed',
      error: `interim provider does not handle job_type "${req.jobType}" yet`,
    });
    return { jobId: job.job_id };
  }

  const input = req.input;
  await updateJob(req.owner, job.job_id, { status: 'running' });
  try {
    const transcriptText = input.transcript
      .map((m) => `${m.role === 'user' ? 'Owner' : 'April'}: ${m.content}`)
      .join('\n\n');
    const body = await complete({
      system: finalizeSystemPrompt(input.brandVoice),
      messages: [
        {
          role: 'user',
          content: `Framing: ${input.framing}\n\nInterview transcript:\n${transcriptText}`,
        },
      ],
      maxTokens: 2000,
      temperature: 0.5,
      json: false, // the concept doc is Markdown, not JSON
    });
    const doc = await saveConcept({
      owner: req.owner, // session owner, never a body-carried value
      stream: input.stream,
      framing: input.framing,
      title: input.framing,
      body_md: stripEmDashes(body.trim()),
    });
    await updateJob(req.owner, job.job_id, {
      status: 'done',
      output_ref: doc.concept_ref,
    });
  } catch (e) {
    // Log the raw provider error server-side; never leak it to the client.
    console.error(
      `[interim-provider] concept_finalize failed (job ${job.job_id}): ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    await updateJob(req.owner, job.job_id, {
      status: 'failed',
      error: 'The concept doc could not be written. Try again in a moment.',
    });
  }
  return { jobId: job.job_id };
}

async function jobStatus(owner: string, jobId: string): Promise<JobView> {
  const job = await getJob(owner, jobId);
  if (!job) return { status: 'failed', error: 'job not found' };
  return { status: job.status, outputRef: job.output_ref, error: job.error };
}

export const interimProvider: AgentProvider = {
  converse,
  submitJob,
  jobStatus,
};
