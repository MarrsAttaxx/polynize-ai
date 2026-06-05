/**
 * "Questions for Polynize" storage — questions.json in the client repo.
 *
 * This is the ONE client-writable artifact. A client can add questions and
 * edit their own un-answered question text; the Polynize team sets status and
 * adds answers. The write routes enforce that access control; this module is
 * just the read/write + pure mutators.
 *
 * Stored as a structured JSON doc (parallel to timeline.json / sow.json)
 * rather than in blueprint.md, because the rows are client-mutated and carry
 * author + timestamp + status + answer per row.
 *
 * "Strict on generate, liberal on read": writes the strict shape; reads
 * leniently so an older or hand-edited file still loads and renders.
 */

import { z } from 'zod';
import { readClientFile, writeClientFile } from '@/lib/github-client';
import type { CommitResult } from '@/lib/github-client';

export const QUESTIONS_PATH = 'questions.json';

export const QUESTION_STATUSES = ['open', 'answered', 'closed'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export const QuestionStatusSchema = z.enum(QUESTION_STATUSES);

export type QuestionAuthorRole = 'client' | 'polynize';

export interface Question {
  id: string;
  text: string;
  /** Email of whoever added the question (from the session at add time). */
  author_email: string;
  /** Scope of the author: a client wrote it, or Polynize did. */
  author_role: QuestionAuthorRole;
  status: QuestionStatus;
  created_at: string;
  /** Polynize answer note, team-set. null until answered. */
  answer: string | null;
  answered_at: string | null;
  answered_by: string | null;
}

export interface QuestionsDoc {
  schema_version: '1.0';
  questions: Question[];
}

/** Strict shape the writer emits. */
export const QuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  author_email: z.string(),
  author_role: z.enum(['client', 'polynize']),
  status: QuestionStatusSchema,
  created_at: z.string(),
  answer: z.string().nullable(),
  answered_at: z.string().nullable(),
  answered_by: z.string().nullable(),
});

export const QuestionsDocSchema = z.object({
  schema_version: z.literal('1.0'),
  questions: z.array(QuestionSchema),
});

/** Lenient per-row read: tolerate missing optional fields, coerce status. */
const LenientQuestionSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    author_email: z.string().optional(),
    author_role: z.string().optional(),
    status: z.string().optional(),
    created_at: z.string().optional(),
    answer: z.string().nullable().optional(),
    answered_at: z.string().nullable().optional(),
    answered_by: z.string().nullable().optional(),
  })
  .transform((q): Question => ({
    id: q.id,
    text: q.text,
    author_email: q.author_email ?? '',
    author_role: q.author_role === 'polynize' ? 'polynize' : 'client',
    status: (QUESTION_STATUSES as readonly string[]).includes(q.status ?? '')
      ? (q.status as QuestionStatus)
      : 'open',
    created_at: q.created_at ?? '',
    answer: q.answer ?? null,
    answered_at: q.answered_at ?? null,
    answered_by: q.answered_by ?? null,
  }));

const LenientQuestionsDocSchema = z.object({
  schema_version: z.string().optional(),
  questions: z.array(LenientQuestionSchema).optional(),
});

const EMPTY_DOC: QuestionsDoc = { schema_version: '1.0', questions: [] };

/** Read + normalise questions.json. Absent or malformed → empty doc. */
export async function readQuestions(slug: string): Promise<QuestionsDoc> {
  let raw: string;
  try {
    raw = await readClientFile(slug, QUESTIONS_PATH);
  } catch {
    return { ...EMPTY_DOC, questions: [] };
  }
  try {
    const parsed = LenientQuestionsDocSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error(`[questions-io] questions.json schema mismatch for ${slug}`, parsed.error.issues.slice(0, 3));
      return { ...EMPTY_DOC, questions: [] };
    }
    return { schema_version: '1.0', questions: parsed.data.questions ?? [] };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[questions-io] questions.json parse failed for ${slug}`, err);
    return { ...EMPTY_DOC, questions: [] };
  }
}

export async function writeQuestions(
  slug: string,
  doc: QuestionsDoc,
  commitMessage: string,
  author?: { name: string; email: string }
): Promise<CommitResult> {
  const content = `${JSON.stringify(doc, null, 2)}\n`;
  return writeClientFile(slug, QUESTIONS_PATH, content, commitMessage, author);
}

/**
 * Authorize a question UPDATE by field and scope. The single source of truth
 * for the field-level access control, extracted so it can be unit-tested.
 *
 *   status / answer  → team only
 *   text             → team always; a CLIENT only on their OWN, still-open question
 *
 * Returns ok, or a 403 with a reason. A combined payload that touches any
 * team-only field is rejected for a client before anything is written.
 */
export function authorizeQuestionUpdate(opts: {
  isTeam: boolean;
  actorEmail: string;
  question: Pick<Question, 'author_role' | 'author_email' | 'status'>;
  fields: { text?: boolean; status?: boolean; answer?: boolean };
}): { ok: true } | { ok: false; status: number; error: string } {
  const { isTeam, actorEmail, question, fields } = opts;

  if ((fields.status || fields.answer) && !isTeam) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: only Polynize can set a question status or answer',
    };
  }

  if (fields.text && !isTeam) {
    const ownsIt =
      question.author_role === 'client' &&
      !!question.author_email &&
      question.author_email.toLowerCase() === actorEmail.toLowerCase();
    if (!ownsIt) {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden: you can only edit your own question',
      };
    }
    if (question.status !== 'open') {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden: an answered question can no longer be edited',
      };
    }
  }

  return { ok: true };
}

/** Next sequential id (q1, q2, ...). */
export function nextQuestionId(doc: QuestionsDoc): string {
  let max = 0;
  for (const q of doc.questions) {
    const m = /^q(\d+)$/.exec(q.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `q${max + 1}`;
}
