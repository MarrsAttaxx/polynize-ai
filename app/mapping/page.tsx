import type { Metadata } from 'next';
import { StoryLanding } from './_story/StoryLanding';
import { storyContent, storyBeats } from './_story/content';

/**
 * The capability mapping page.
 *
 * This was built at /mapping/story as an experiment beside the original /mapping. It
 * won, so it is the page now: the original landing (MappingLanding, mapping.module.css,
 * SiloDiagram) has been deleted and /mapping/story 308s here from next.config.mjs.
 *
 * The implementation still lives in ./_story. The leading underscore makes it a private
 * folder in the App Router, so it can never become a route again no matter what files
 * end up in it.
 */
export const metadata: Metadata = {
  title: 'Team Capability Mapping',
  description:
    'Map what your team can actually do with AI. Before you invest another dollar, see what your people can genuinely do with it, benchmarked against what good looks like.',
  openGraph: {
    title: 'Team Capability Mapping · Polynize',
    description:
      'Before you invest another dollar in AI, see what your people can actually do with it, benchmarked against industry standards.',
  },
};

export default function MappingPage() {
  return <StoryLanding content={storyContent} beats={storyBeats} />;
}
