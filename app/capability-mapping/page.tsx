import type { Metadata } from 'next';
import { StoryLanding } from '../_landing/StoryLanding';
import { WORK_FIGURES } from '../_landing/figures-work';
import { CapabilityMapExample } from '../_landing/CapabilityMapExample';
import {
  workArtefacts,
  workArtefactsFootnote,
  workArtefactsIntro,
  workBeats,
  workContent,
} from '../_landing/content-work';

/**
 * /capability-mapping, the work-modelling narrative.
 *
 * The second of three landing pages sharing app/_landing. /mapping asks what your
 * people can do with AI and answers with a matrix. This asks where AI belongs in the
 * work at all and answers with the capability map: one bottleneck, every capability in
 * it, split human, hybrid, agentic. An enterprise version is coming from Shourov.
 *
 * THIS IS THE ONE THAT RANKS (Marrs, 11 Aug 2026). It was noindex while the three were
 * being judged; it won, so the block is gone. /mapping now carries the noindex and a
 * canonical pointing here, because two near-identical pages competing for the same terms
 * split the signal and read as doorway pages to a crawler.
 */
export const metadata: Metadata = {
  title: 'Capability Mapping',
  description:
    'Before you decide where AI belongs, map the work into its capabilities and see which are human, which are agentic, and which are both.',
  openGraph: {
    title: 'Capability Mapping · Polynize',
    description:
      'See how your work actually works. One bottleneck, every capability in it, allocated human, hybrid or agentic.',
  },
};

export default function CapabilityMappingPage() {
  return (
    <StoryLanding
      content={workContent}
      beats={workBeats}
      figures={WORK_FIGURES}
      result={<CapabilityMapExample />}
      resultEyebrow="The fix"
      artefacts={workArtefacts}
      artefactsIntro={workArtefactsIntro}
      artefactsFootnote={workArtefactsFootnote}
      surface="capmap"
    />
  );
}
