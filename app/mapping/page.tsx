import type { Metadata } from 'next';
import { MappingLanding } from './MappingLanding';
import { mappingContent } from './content';

export const metadata: Metadata = {
  title: 'Team Capability Mapping',
  description:
    'Map what your team can actually do. A three hour session that shows where your team’s capability sits against the work that matters, so you can see where to invest next. You leave with the map, the data, and a report.',
  openGraph: {
    title: 'Team Capability Mapping · Polynize',
    description:
      'Map what your team can actually do, against the work that matters, so you can see where to invest next.',
  },
};

export default function MappingPage() {
  return <MappingLanding content={mappingContent} />;
}
