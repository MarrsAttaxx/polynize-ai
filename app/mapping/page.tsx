import type { Metadata } from 'next';
import { StoryLanding } from '../_landing/StoryLanding';
import { AI_FIGURES } from '../_landing/figures-ai';
import { CapabilityMatrix } from '../_landing/CapabilityMatrix';
import {
  artefacts,
  artefactsFootnote,
  artefactsIntro,
  storyBeats,
  storyContent,
  storyScale,
} from '../_landing/content-ai';

/**
 * /mapping, the AI-capability narrative.
 *
 * NOINDEX, CANONICAL TO /capability-mapping (Marrs, 11 Aug 2026). That page won the
 * three-way and is the one being pushed, so this one stops competing with it for the same
 * terms. It stays fully live and linkable: noindex keeps it out of the results, it does
 * not take it off the internet, and every CTA on it still works.
 *
 * The layout lives in app/_landing, shared with the other landing pages. This file is
 * only the wiring: which copy, which beats, which figures, and which artefact the turn
 * line hands over to. Here that artefact is the capability MATRIX, every person against
 * every capability a process asks of them.
 */
export const metadata: Metadata = {
  title: 'Team Capability Mapping',
  description:
    'Map what your team can actually do with AI. Before you invest another dollar, see what your people can genuinely do with it, benchmarked against what good looks like.',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://www.polynize.ai/capability-mapping' },
  openGraph: {
    title: 'Team Capability Mapping · Polynize',
    description:
      'Before you invest another dollar in AI, see what your people can actually do with it, benchmarked against industry standards.',
  },
};

export default function MappingPage() {
  return (
    <StoryLanding
      content={storyContent}
      beats={storyBeats}
      figures={AI_FIGURES}
      result={<CapabilityMatrix />}
      artefacts={artefacts}
      artefactsIntro={artefactsIntro}
      artefactsFootnote={artefactsFootnote}
      scale={storyScale}
      surface="mapping"
    />
  );
}
