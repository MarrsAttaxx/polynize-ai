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
    'Map what your team can actually do. A three hour session that shows where your team’s capability sits against the work that matters, so you can see where to invest next.',
  robots: { index: false, follow: false },
};

export default function MappingStoryPage() {
  return <StoryLanding content={storyContent} beats={storyBeats} />;
}
