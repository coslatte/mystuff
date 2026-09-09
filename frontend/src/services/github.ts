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

  const token = (import.meta.env as unknown as Record<string, string | undefined>).GITHUB_TOKEN;
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

export async function fetchPinnedRepos(username: string = "coslatte"): Promise<PinnedRepo[]> {
  const token = (import.meta.env as unknown as Record<string, string | undefined>).GITHUB_TOKEN;

  if (!token) return [];

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

    if (!response.ok) return [];

    const result = (await response.json()) as {
      data?: { user?: { pinnedItems: { nodes: PinnedRepo[] } } };
      errors?: unknown;
    };

    if (result.errors || !result.data?.user) return [];

    return result.data.user.pinnedItems.nodes;
  } catch {
    return [];
  }
}
