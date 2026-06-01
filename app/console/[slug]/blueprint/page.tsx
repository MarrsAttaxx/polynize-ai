/**
 * Blueprint route — branches on blueprint_schema_version.
 *
 *   schema 1.x (or absent) → LegacyBlueprintView (modelling/blueprint.md)
 *   schema 2.0             → V2BlueprintView (JSON canonical files)
 *
 * The legacy renderer is unchanged. Existing engagements without a
 * blueprint_schema_version field default to '1.0' and render via the
 * legacy path. Only engagements whose client-config.yaml declares
 * blueprint_schema_version: 2.0 hit the new renderer.
 */

import { notFound } from 'next/navigation';
import YAML from 'yaml';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile } from '@/lib/github-client';
import { getCurrentUser, userHasClientAccess } from '@/lib/console-auth';
import type { BlueprintSchemaVersion } from '@/lib/blueprint/schema-v2';
import { LegacyBlueprintView } from './LegacyView';
import { V2BlueprintView } from './V2View';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

type ConfigShape = {
  client?: { name?: string };
  engagement?: { phase?: string; sub_phase?: string; gate_next?: string };
  blueprint_schema_version?: string | null;
};

function parseSchemaVersion(raw: unknown): BlueprintSchemaVersion {
  if (raw === '2.0') return '2.0';
  if (raw === '1.1') return '1.1';
  return '1.0';
}

async function loadClientConfig(slug: string): Promise<ConfigShape | null> {
  try {
    const yamlText = await readClientFile(slug, '.polynize/client-config.yaml');
    return (YAML.parse(yamlText) as ConfigShape) ?? null;
  } catch {
    return null;
  }
}

export default async function BlueprintPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;

  // Slug format guard (rejects path-traversal / malformed input). Existence
  // is enforced below by whether the engagement's config actually loads —
  // engagements are discovered dynamically, not from a fixed allowlist.
  if (!isValidConsoleSlug(slug)) {
    notFound();
  }

  // Authz: client-scoped users can only see their own slug.
  // 404 (not 403) to avoid hinting other clients exist.
  const user = await getCurrentUser();
  if (user && !userHasClientAccess(user, slug)) {
    notFound();
  }

  const config = await loadClientConfig(slug);
  // No config = no engagement repo at this slug (or no marker file) → 404.
  if (!config) {
    notFound();
  }
  const isTeamUser = user?.scope.type === 'team';

  const version = parseSchemaVersion(config?.blueprint_schema_version);

  if (version === '2.0') {
    const actorEmail = user?.scope.type === 'team' ? user.email : null;
    return (
      <V2BlueprintView
        slug={slug}
        isTeamUser={isTeamUser}
        actorEmail={actorEmail}
      />
    );
  }

  return (
    <LegacyBlueprintView slug={slug} config={config} isTeamUser={isTeamUser} />
  );
}
