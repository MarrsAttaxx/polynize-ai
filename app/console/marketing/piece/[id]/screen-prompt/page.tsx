import { redirect } from 'next/navigation';

/**
 * The stage moved to `interface` when it was renamed (D31, 2026-07-28). This keeps the
 * old path working: the stage is bookmarked, and it is the sort of page left open in a
 * tab for days while a piece is in production, so a dead link here would read as the
 * console losing the work rather than as a rename.
 */
export default async function ScreenPromptRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/console/marketing/piece/${id}/interface`);
}
