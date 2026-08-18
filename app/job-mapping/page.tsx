import type { Metadata } from 'next';
import { DraftingGrid } from '../_components/DraftingGrid';
import { SiteFooter } from '../_components/SiteFooter';
import { JobMappingFlow } from './JobMappingFlow';
import s from './job-mapping.module.css';

/**
 * /job-mapping
 *
 * One page, no separate landing page in front of it: traffic arrives from social and the
 * page has to do the whole job itself (Marrs, 12 Aug 2026). So the input is above the fold
 * and everything below it is there to make pasting a job description feel reasonable.
 *
 * Indexed, deliberately. "AI job description analysis" is a search people make, and this is
 * a genuine answer to it.
 */
export const metadata: Metadata = {
  title: 'Map your job against AI',
  description:
    'Paste your job description and get a capability map of the role: what stays human, what becomes hybrid, and what an agent can run. Free, and yours to keep.',
  openGraph: {
    title: 'Map your job against AI · Polynize',
    description:
      'Paste your job description and get a capability map of the role: what stays human, what becomes hybrid, and what an agent can run.',
  },
};

export default function JobMappingPage() {
  return (
    <>
      <DraftingGrid />
      <main className={s.page}>
        <JobMappingFlow />
      </main>
      <SiteFooter />
    </>
  );
}
