/**
 * GET /console/scene/demo — the SCENE engine (D31) on a touchable URL.
 *
 * A scene is an interface, so it cannot be judged from a screenshot: the whole question
 * is whether it feels like operating something. This serves a worked example on the
 * studio touchscreen so that judgement can be made with hands before the console is
 * rewired to generate real ones.
 *
 * Unauthenticated for the same reason as the deck route: the studio machine opens it
 * with no console login, and a Route Handler bypasses the /console sign-in gate.
 */

import { renderScene, type Scene } from '@/lib/marketing/scene';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO: Scene = {
  title: 'Three Divergent Classes',
  concept: 'Three Divergent Classes',
  nodes: [
    {
      label: 'AI Addicts',
      colour: 'coral',
      facts: [
        { label: 'Risk profile', value: 'High' },
        { label: 'Cognitive trend', value: 'Declining' },
        { label: 'Market value', value: 'Falling' },
      ],
    },
    {
      label: 'AI Illiterate',
      colour: 'amber',
      facts: [
        { label: 'Risk profile', value: 'Medium' },
        { label: 'Cognitive trend', value: 'Flat' },
        { label: 'Market value', value: 'Eroding' },
      ],
    },
    {
      label: 'AI Amplified',
      colour: 'mint',
      facts: [
        { label: 'Risk profile', value: 'Low' },
        { label: 'Cognitive trend', value: 'Compounding' },
        { label: 'Market value', value: 'Rising' },
      ],
    },
  ],
  close: 'Build the human, then amplify',
};

export async function GET() {
  return new Response(renderScene(DEMO), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
