import { redirect } from 'next/navigation';

/**
 * This stage has been renamed twice (screen prompt, then interface, now PREZIE). Both old
 * paths redirect: the stage gets bookmarked and left open in a tab for days while a piece
 * is in production, so a dead link would read as the console losing the work.
 */
export default async function RenamedStageRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/console/marketing/piece/${id}/prezie`);
}
