import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { listTemplates, type ContentTemplate } from '@/lib/marketing/template-store';
import { LIBRARY_TEMPLATES } from '@/lib/marketing/template-library';
import { TemplatePicker } from './TemplatePicker';
import s from './create.module.css';

export const dynamic = 'force-dynamic';

/**
 * Create content from a concept (D25) — the DEFAULT creation path: pick a
 * Content Pillar Template and the template carries the plan (format, platforms,
 * ICP, recipe). Shows the stream's own templates plus the built-in library;
 * the custom Output-plan form remains as the fallback link. Team-scope only.
 */
export default async function CreateFromConceptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  let concept = null;
  try {
    concept = await getConcept(user.email, slug);
  } catch (err) {
    console.error('[concept.create] read failed:', err);
  }
  if (!concept) {
    return (
      <div className={s.root}>
        <Link href="/console/marketing" className={s.back}>
          ← Marketing
        </Link>
        <p className={s.notFound}>
          No concept found for <code>{slug}</code>.
        </p>
      </div>
    );
  }

  // Dedupe the library against ALL stream templates (retired included), so
  // retiring a stream copy doesn't resurrect its library original in the picker.
  let streamTemplates: ContentTemplate[] = [];
  let library = LIBRARY_TEMPLATES;
  try {
    const all = await listTemplates(concept.stream);
    streamTemplates = all.filter((t) => t.status !== 'retired');
    const copiedIds = new Set(all.map((t) => t.template_id));
    library = LIBRARY_TEMPLATES.filter((t) => !copiedIds.has(t.template_id));
  } catch (err) {
    console.error('[concept.create] template list failed:', err);
  }

  return (
    <div className={s.root}>
      {/* The header lives INSIDE the picker so it can stand down once a template is
          chosen: on the angle screen everything above the question is a distraction
          (Marrs), and a server-rendered header cannot be hidden by a client step. */}
      <TemplatePicker
        streamTemplates={streamTemplates}
        libraryTemplates={library}
        stream={concept.stream}
        conceptSlug={slug}
        backHref={`/console/marketing/concept/${slug}`}
        dashboardHref={`/console/marketing/stream/${concept.stream}`}
        planHref={`/console/marketing/concept/${slug}/plan`}
      />
    </div>
  );
}
