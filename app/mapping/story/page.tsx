import type { Metadata } from 'next';
import { StoryLanding } from './StoryLanding';
import { storyContent, storyBeats } from './content';

/**
 * Scroll-story experiment, parallel to /mapping. Lives on its own URL so the live
 * page cannot be affected while this is being judged.
 *
 * noindex on purpose: two near-identical pages competing for the same terms would
 * split the signal, and this one may well be thrown away. Remove `robots` if it wins
 * and /mapping is retired.
 */
export const metadata: Metadata = {
  title: 'Team Capability Mapping',
  description:
    'Map what your team can actually do with AI. Before you invest another dollar, see what your people can genuinely do with it, benchmarked against what good looks like.',
  robots: { index: false, follow: false },
};

export default function MappingStoryPage() {
  return <StoryLanding content={storyContent} beats={storyBeats} />;
}
