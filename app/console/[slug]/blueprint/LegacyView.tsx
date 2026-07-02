/**
 * Legacy (1.x) Blueprint renderer.
 *
 * This is the renderer that has existed since the PAM Console first
 * shipped. It reads modelling/blueprint.md and renders the markdown
 * sections via the parse-blueprint helpers. It is unchanged from the
 * pre-Stage-2 implementation; the only structural change is that it
 * now lives in a component file (instead of page.tsx) so the v2
 * renderer branch in page.tsx can dispatch to it.
 *
 * IMPORTANT: do not touch this renderer. All existing Blueprints
 * (Newkind, reMYnd, EverStock, Roxbury's, any unmigrated client)
 * render via this path. The Stage 2 renderer is a separate component
 * gated on blueprint_schema_version: 2.0.
 */

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { readClientFile } from '@/lib/github-client';
import {
  parseBlueprint,
  parseCapabilityMapUnit,
  parseCapabilityMapAgent,
  parseGapRegister,
  parseInfrastructure,
  parseTeamOrg,
  extractBlueprintVersion,
  identifyTeamRoles,
  type BlueprintSection,
  type GapRegisterParsed,
  type TeamOrgParsed,
} from '@/app/console/_lib/parse-blueprint';
import { ReadinessStrip } from '@/app/console/_components/blueprint/ReadinessStrip';
import { CapabilityMapUnit } from '@/app/console/_components/blueprint/CapabilityMapUnit';
import { CapabilityMapAgent } from '@/app/console/_components/blueprint/CapabilityMapAgent';
import { GapRegister } from '@/app/console/_components/blueprint/GapRegister';
import { Infrastructure } from '@/app/console/_components/blueprint/Infrastructure';
import { TeamOrg } from '@/app/console/_components/blueprint/TeamOrg';
import { RefreshButton } from './RefreshButton';
import s from './blueprint.module.css';

type ClientConfig = {
  client?: { name?: string };
  engagement?: { phase?: string; sub_phase?: string; gate_next?: string };
};

type SectionHeaderInfo = { number: string | null; title: string };

function splitSectionTitle(raw: string): SectionHeaderInfo {
  const m = raw.match(/^(\d{2})\s+·\s+(.+)$/);
  if (m) return { number: m[1], title: m[2] };
  return { number: null, title: raw };
}

function MarkdownPanel({ content }: { content: string }) {
  return (
    <div className={s.markdownPanel}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function SectionShell({
  section,
  children,
}: {
  section: BlueprintSection;
  children: React.ReactNode;
}) {
  const { number, title } = splitSectionTitle(section.title);
  return (
    <section id={section.id} className={s.section}>
      <div className={s.sectionHeader}>
        {number && <span className={s.sectionNumber}>{number}</span>}
        <h2 className={s.sectionTitle}>{title}</h2>
      </div>
      <div className={s.sectionBody}>{children}</div>
    </section>
  );
}

function renderSection(
  section: BlueprintSection,
  slug: string,
  canEdit: boolean
): React.ReactNode {
  switch (section.id) {
    case 'capability-map-unit': {
      const data = parseCapabilityMapUnit(section.content);
      if (data) return <CapabilityMapUnit data={data} />;
      return <MarkdownPanel content={section.content} />;
    }
    case 'capability-map-agent': {
      const data = parseCapabilityMapAgent(section.content);
      if (data) return <CapabilityMapAgent data={data} />;
      return <MarkdownPanel content={section.content} />;
    }
    case 'team': {
      const data = parseTeamOrg(section.content);
      if (data) return <TeamOrg data={data} />;
      return <MarkdownPanel content={section.content} />;
    }
    case 'gap-register': {
      const data = parseGapRegister(section.content);
      if (data) return <GapRegister data={data} slug={slug} canEdit={canEdit} />;
      return <MarkdownPanel content={section.content} />;
    }
    case 'infrastructure': {
      const data = parseInfrastructure(section.content);
      if (data && (data.polynize || data.client)) {
        return <Infrastructure data={data} />;
      }
      return <MarkdownPanel content={section.content} />;
    }
    default:
      return <MarkdownPanel content={section.content} />;
  }
}

export async function LegacyBlueprintView({
  slug,
  config,
  isTeamUser,
}: {
  slug: string;
  config: ClientConfig | null;
  isTeamUser: boolean;
}) {
  const markdownResult = await readClientFile(slug, 'modelling/blueprint.md').catch(
    () => null
  );

  if (markdownResult === null) {
    const clientName = config?.client?.name ?? slug;
    return (
      <>
        <div className={s.bgPattern} aria-hidden />
        <div className={s.container}>
          <header className={s.header}>
            <div className={s.eyebrow}>
              POLYNIZE AGENTIC MANAGEMENT CONSOLE · CLIENT BLUEPRINT
            </div>
            <h1 className={s.title}>{clientName}</h1>
            {isTeamUser && (
              <Link href="/console/blueprinting" className={s.backLink}>
                ← All clients
              </Link>
            )}
          </header>
          <p className={s.emptyState}>
            Blueprint not yet populated. Add content to{' '}
            <code>modelling/blueprint.md</code> in the client repo to populate this
            dashboard.
          </p>
        </div>
      </>
    );
  }

  const parsed = parseBlueprint(markdownResult);

  const gapSection = parsed.sections.find((sec) => sec.id === 'gap-register');
  const gapParsed: GapRegisterParsed | null = gapSection
    ? parseGapRegister(gapSection.content)
    : null;

  const teamSection = parsed.sections.find((sec) => sec.id === 'team');
  const teamParsed: TeamOrgParsed | null = teamSection
    ? parseTeamOrg(teamSection.content)
    : null;

  const agentCount = teamParsed
    ? identifyTeamRoles(teamParsed).children.length +
      (identifyTeamRoles(teamParsed).spoc ? 1 : 0)
    : 0;

  const blueprintVersion =
    extractBlueprintVersion(parsed.preamble.intro) ?? 'v0.1';

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.container}>
        <header className={s.header}>
          <div className={s.eyebrow}>
            POLYNIZE AGENTIC MANAGEMENT CONSOLE · CLIENT BLUEPRINT
          </div>
          <h1 className={s.title}>{parsed.preamble.title}</h1>
          <div className={s.headerActions}>
            {isTeamUser ? (
              <Link href="/console/blueprinting" className={s.backLink}>
                ← All clients
              </Link>
            ) : (
              <span aria-hidden />
            )}
            {isTeamUser && <RefreshButton slug={slug} />}
          </div>
        </header>

        {parsed.preamble.intro && (
          <div className={s.intro}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.preamble.intro}
            </ReactMarkdown>
          </div>
        )}

        <ReadinessStrip
          blueprint={parsed}
          gapsOpen={gapParsed?.openCount ?? 0}
          gapsBlocking={gapParsed?.blockingCount ?? 0}
          phase={config?.engagement?.phase ?? ''}
          subPhase={config?.engagement?.sub_phase ?? ''}
          gateNext={config?.engagement?.gate_next ?? ''}
          agentCount={agentCount}
          unitCount={1}
          blueprintVersion={blueprintVersion}
        />

        {parsed.sections.map((section) => (
          <SectionShell key={section.id} section={section}>
            {renderSection(section, slug, isTeamUser)}
          </SectionShell>
        ))}
      </div>
    </>
  );
}
