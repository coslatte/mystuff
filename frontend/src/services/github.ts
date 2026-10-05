import { GITHUB_TOKEN } from "astro:env/server";
import type { PinnedRepo } from "../types/github";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

// Typed by `env.schema` in astro.config.mjs. Astro loads .env into it for
// server code, so the token needs no manual parsing. Without a token every call
// degrades to an empty repo list rather than failing the build.

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
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== "github.com") return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length >= 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  return null;
}

export async function fetchRepoMediaImage(githubUrl: string): Promise<string | null> {
  const repo = repoFromUrl(githubUrl);
  if (!repo) return null;

  const headers: Record<string, string> = GITHUB_TOKEN
    ? { Authorization: `bearer ${GITHUB_TOKEN}` }
    : {};

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
      continue;
    }
  }

  return null;
}

const PINNED_CACHE_TTL_MS = 10 * 60 * 1000;

let pinnedCache: { ts: number; data: PinnedRepo[] } | null = null;

export async function fetchPinnedRepos(username: string = "coslatte"): Promise<PinnedRepo[]> {
  if (!GITHUB_TOKEN) return [];

  if (pinnedCache && Date.now() - pinnedCache.ts < PINNED_CACHE_TTL_MS) {
    return pinnedCache.data;
  }

  try {
    const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `bearer ${GITHUB_TOKEN}`,
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
