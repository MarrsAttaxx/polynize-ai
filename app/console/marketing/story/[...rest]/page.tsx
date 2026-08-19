import { redirect } from 'next/navigation';

/**
 * THE OLD URL (D43). Narratives lived at /console/marketing/story/... until the rename, so an
 * open tab or a bookmark still points here. Twelve lines beats a 404 on a narrative mid-gate.
 *
 * GET only, which is all that is needed: the gate screen POSTs from whatever page it was served
 * by, so a redirected load then talks to the new routes on its own.
 */
export default async function LegacyNarrativeRedirect({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest } = await params;
  const tail = (rest ?? []).join('/');
  redirect(`/console/marketing/narrative${tail ? `/${tail}` : ''}`);
}
