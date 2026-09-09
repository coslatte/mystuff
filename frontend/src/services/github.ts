import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface PinnedRepo {
  id: string;
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  primaryLanguage: { name: string } | null;
  repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
}

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

let cachedLocalToken: string | undefined | null = null;

function readLocalEnvToken(): string | undefined {
  if (cachedLocalToken !== null) return cachedLocalToken;

  try {
    const envPath = resolve(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*GITHUB_TOKEN\s*=\s*(.+?)\s*$/);
      if (match) {
        cachedLocalToken = match[1].trim().replace(/^["']|["']$/g, "");
        return cachedLocalToken;
      }
    }
  } catch {
    /* .env no disponible (p.ej. produccion): se ignora */
  }

  cachedLocalToken = undefined;
  return undefined;
}

function getGithubToken(): string | undefined {
  return process.env.GITHUB_TOKEN ?? readLocalEnvToken();
}


const PINNED_REPOS_QUERY = `
  query getPinnedRepos($username: String!) {
    user(login: $username) {
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            id
            name
            description
            url
            stargazerCount
            primaryLanguage {
              name
            }
            repositoryTopics(first: 5) {
              nodes {
                topic {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

const MEDIA_FOLDERS = ["assets", "screenshots"];
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function repoFromUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    /* fallthrough */
  }
  return null;
}

export async function fetchRepoMediaImage(githubUrl: string): Promise<string | null> {
  const repo = repoFromUrl(githubUrl);
  if (!repo) return null;

  const token = getGithubToken();
  const headers: Record<string, string> = token ? { Authorization: `bearer ${token}` } : {};

  for (const folder of MEDIA_FOLDERS) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${folder}`,
        { headers }
      );
      if (!response.ok) continue;

      const items = (await response.json()) as Array<{ type: string; name: string; download_url: string | null }>;
      if (!Array.isArray(items)) continue;

      const image = items.find((item) => item.type === "file" && IMAGE_EXTENSIONS.test(item.name));
      if (image?.download_url) return image.download_url;
    } catch {
      /* fallthrough to next folder */
    }
  }

  return null;
}

const PINNED_CACHE_TTL_MS = 10 * 60 * 1000;

let pinnedCache: { ts: number; data: PinnedRepo[] } | null = null;

export async function fetchPinnedRepos(username: string = "coslatte"): Promise<PinnedRepo[]> {
  const token = getGithubToken();

  if (!token) return [];

  if (pinnedCache && Date.now() - pinnedCache.ts < PINNED_CACHE_TTL_MS) {
    return pinnedCache.data;
  }

  try {
    const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: PINNED_REPOS_QUERY,
        variables: { username },
      }),
    });

    if (!response.ok) return pinnedCache?.data ?? [];

    const result = (await response.json()) as {
      data?: { user?: { pinnedItems: { nodes: PinnedRepo[] } } };
      errors?: unknown;
    };

    if (result.errors || !result.data?.user) return pinnedCache?.data ?? [];

    const EXCLUDED_REPOS = new Set(["cosmiclatteweb", "mystuff"]);
    const data = result.data.user.pinnedItems.nodes.filter(
      (repo) => !EXCLUDED_REPOS.has(repo.name.toLowerCase())
    );

    pinnedCache = { ts: Date.now(), data };
    return data;
  } catch {
    return pinnedCache?.data ?? [];
  }
}
