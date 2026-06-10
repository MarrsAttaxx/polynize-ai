import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadBlueprint } from '@/lib/blueprint/load';
import { DraftingGrid } from '@/app/_components/DraftingGrid';
import { TopBar } from './TopBar';
import { Cover } from './Cover';
import { Heatmap } from './Heatmap';
import { Team } from './Team';
import { Day } from './Day';
import { FinalCTA } from './FinalCTA';
import s from './blueprint.module.css';

type Params = { id: string };
type Search = { demo?: string };

export const metadata: Metadata = {
  title: 'Your blueprint · polynize.ai',
};

export default async function BlueprintPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const payload = await loadBlueprint(id, sp.demo === '1');
  if (!payload) notFound();

  return (
    <>
      <DraftingGrid />
      <div className={s.body}>
        <TopBar docRef={payload.docRef} />
        <Cover payload={payload} />
        <Heatmap payload={payload} />
        <Team payload={payload} />
        <Day payload={payload} />
        <FinalCTA payload={payload} />
      </div>
    </>
  );
}
