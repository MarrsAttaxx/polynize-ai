import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

const ORG = 'polynize-agentic';

let cached: Octokit | null = null;

function normalizePrivateKey(raw: string): string {
  // PEM keys in env vars often arrive with literal `\n` sequences instead
  // of actual newlines (depending on how they were pasted into Vercel).
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

export async function getInstallationOctokit(): Promise<Octokit> {
  if (cached) return cached;

  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId) throw new Error('GITHUB_APP_ID must be set');
  if (!installationId) throw new Error('GITHUB_APP_INSTALLATION_ID must be set');
  if (!privateKey) throw new Error('GITHUB_APP_PRIVATE_KEY must be set');

  cached = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: Number(appId),
      privateKey: normalizePrivateKey(privateKey),
      installationId: Number(installationId),
    },
  });

  return cached;
}

/**
 * Repos the GitHub App can see but that are NOT engagements (so they are
 * excluded from discovery). The app/website repo itself lives here.
 */
const NON_ENGAGEMENT_REPOS = new Set<string>(['polynize-ai']);

/**
 * Dynamically discover the repo slugs the installation can access, under the
 * configured owner, excluding known non-engagement repos. This is the source
 * of truth for "which engagements exist" — a freshly-seeded repo appears
 * automatically with no code change.
 *
 * Uses GET /installation/repositories (the installation-token endpoint), so
 * it returns exactly the repos this App installation is granted. The caller
 * still confirms each candidate is an engagement by checking for the
 * `.polynize/client-config.yaml` marker (a repo without it is filtered out).
 */
export async function listAccessibleRepoSlugs(): Promise<string[]> {
  const octokit = await getInstallationOctokit();
  const repos = (await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 }
  )) as Array<{ name: string; owner?: { login?: string } }>;
  return repos
    .filter((r) => !r.owner || !r.owner.login || r.owner.login === ORG)
    .map((r) => r.name)
    .filter((name) => !NON_ENGAGEMENT_REPOS.has(name));
}

export async function readClientFile(slug: string, path: string): Promise<string> {
  const octokit = await getInstallationOctokit();

  const response = await octokit.rest.repos.getContent({
    owner: ORG,
    repo: slug,
    path,
  });

  const data = response.data;

  if (Array.isArray(data)) {
    throw new Error(
      `Path "${path}" in repo "${ORG}/${slug}" is a directory, not a file`
    );
  }

  if (data.type !== 'file') {
    throw new Error(
      `Path "${path}" in repo "${ORG}/${slug}" is not a file (type: ${data.type})`
    );
  }

  if (data.encoding !== 'base64') {
    throw new Error(
      `Unexpected encoding "${data.encoding}" for "${path}" in repo "${ORG}/${slug}"`
    );
  }

  if (!data.content) {
    throw new Error(
      `No content returned for "${path}" in repo "${ORG}/${slug}" (file may exceed 1 MB; blob API needed)`
    );
  }

  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function readClientFileLastCommit(
  slug: string,
  path: string
): Promise<Date | null> {
  try {
    const octokit = await getInstallationOctokit();
    const response = await octokit.rest.repos.listCommits({
      owner: ORG,
      repo: slug,
      path,
      per_page: 1,
    });
    if (response.data.length === 0) return null;
    const first = response.data[0];
    const dateStr = first.commit.committer?.date ?? first.commit.author?.date;
    if (!dateStr) return null;
    return new Date(dateStr);
  } catch (err) {
    console.error(
      `[github-client] readClientFileLastCommit failed for ${ORG}/${slug}/${path}`,
      err
    );
    return null;
  }
}

// ============================================================
// Write helpers — require Contents: Read & write on the App
// ============================================================

export type CommitResult = { sha: string; url: string };

function errorHasStatus(err: unknown): err is { status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}

async function fetchCurrentSha(
  slug: string,
  path: string
): Promise<string | null> {
  const octokit = await getInstallationOctokit();
  try {
    const response = await octokit.rest.repos.getContent({
      owner: ORG,
      repo: slug,
      path,
    });
    const data = response.data;
    if (Array.isArray(data)) {
      throw new Error(
        `Path "${path}" in repo "${ORG}/${slug}" is a directory, not a file`
      );
    }
    if (data.type !== 'file') {
      throw new Error(
        `Path "${path}" in repo "${ORG}/${slug}" is not a file (type: ${data.type})`
      );
    }
    return data.sha;
  } catch (err) {
    if (errorHasStatus(err) && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function writeClientFile(
  slug: string,
  path: string,
  content: string,
  commitMessage: string,
  author?: { name: string; email: string }
): Promise<CommitResult> {
  const octokit = await getInstallationOctokit();

  const currentSha = await fetchCurrentSha(slug, path);
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

  try {
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: ORG,
      repo: slug,
      path,
      message: commitMessage,
      content: contentBase64,
      ...(currentSha ? { sha: currentSha } : {}),
      ...(author ? { author, committer: author } : {}),
    });

    const commit = response.data.commit;
    if (!commit?.sha) {
      throw new Error(
        `createOrUpdateFileContents returned no commit sha for ${ORG}/${slug}/${path}`
      );
    }
    return { sha: commit.sha, url: commit.html_url ?? '' };
  } catch (err) {
    if (errorHasStatus(err) && (err.status === 409 || err.status === 422)) {
      throw new Error(
        `Conflict writing ${ORG}/${slug}/${path}: file changed since read (HTTP ${err.status}). Retry with a fresh read.`
      );
    }
    throw err;
  }
}

export async function deleteClientFile(
  slug: string,
  path: string,
  commitMessage: string
): Promise<{ sha: string }> {
  const octokit = await getInstallationOctokit();

  const currentSha = await fetchCurrentSha(slug, path);
  if (!currentSha) {
    throw new Error(
      `Cannot delete ${ORG}/${slug}/${path}: file does not exist`
    );
  }

  const response = await octokit.rest.repos.deleteFile({
    owner: ORG,
    repo: slug,
    path,
    message: commitMessage,
    sha: currentSha,
  });

  const commit = response.data.commit;
  if (!commit?.sha) {
    throw new Error(
      `deleteFile returned no commit sha for ${ORG}/${slug}/${path}`
    );
  }
  return { sha: commit.sha };
}
