import { GITHUB_TOKEN } from "astro:env/server";
import type { ContributionSummary, PinnedRepo } from "../types/github";

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

const CONTRIBUTION_SUMMARY_QUERY = `
  query getContributionSummary($username: String!) {
    user(login: $username) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              color
              contributionCount
              date
              weekday
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

/**
 * GitHub rate-limits per token, and `/coding` asks for two things on every cold
 * render, so the request is kept here instead of being written twice.
 */
async function requestGraphQL(query: string, variables: Record<string, string>): Promise<unknown> {
  if (!GITHUB_TOKEN) return null;

  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) return null;

  const result = (await response.json()) as { data?: unknown; errors?: unknown };
  if (result.errors) return null;
  return result.data;
}

export async function fetchPinnedRepos(username: string = "coslatte"): Promise<PinnedRepo[]> {
  if (!GITHUB_TOKEN) return [];

  if (pinnedCache && Date.now() - pinnedCache.ts < PINNED_CACHE_TTL_MS) {
    return pinnedCache.data;
  }

  try {
    const data = (await requestGraphQL(PINNED_REPOS_QUERY, { username })) as
      | { user?: { pinnedItems: { nodes: PinnedRepo[] } } }
      | null;

    if (!data?.user) return pinnedCache?.data ?? [];

    const EXCLUDED_REPOS = new Set(["cosmiclatteweb", "mystuff"]);
    const repos = data.user.pinnedItems.nodes.filter(
      (repo) => !EXCLUDED_REPOS.has(repo.name.toLowerCase())
    );

    pinnedCache = { ts: Date.now(), data: repos };
    return repos;
  } catch {
    return pinnedCache?.data ?? [];
  }
}

let contributionCache: { ts: number; data: ContributionSummary } | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseContributionSummary(value: unknown): ContributionSummary | null {
  if (!isRecord(value) || typeof value.totalContributions !== "number"
    || !Number.isInteger(value.totalContributions) || value.totalContributions < 0
    || !Array.isArray(value.weeks) || value.weeks.length === 0) return null;

  const weeks: ContributionSummary["weeks"] = [];
  for (const week of value.weeks) {
    if (!isRecord(week) || !Array.isArray(week.contributionDays)) return null;
    const contributionDays: ContributionSummary["weeks"][number]["contributionDays"] = [];
    for (const day of week.contributionDays) {
      if (!isRecord(day) || typeof day.color !== "string" || !/^#[0-9a-f]{6}$/i.test(day.color)
        || typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)
        || typeof day.contributionCount !== "number" || !Number.isInteger(day.contributionCount) || day.contributionCount < 0
        || typeof day.weekday !== "number" || !Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) return null;
      contributionDays.push({
        color: day.color,
        date: day.date,
        contributionCount: day.contributionCount,
        weekday: day.weekday,
      });
    }
    weeks.push({ contributionDays });
  }
  return { totalContributions: value.totalContributions, weeks };
}

/**
 * `null` rather than zero when the count is unavailable, so the page can leave
 * the stat out instead of claiming a number it never read.
 */
export async function fetchContributionSummary(
  username: string = "coslatte"
): Promise<ContributionSummary | null> {
  if (!GITHUB_TOKEN) return null;

  if (contributionCache && Date.now() - contributionCache.ts < PINNED_CACHE_TTL_MS) {
    return contributionCache.data;
  }

  try {
    const data = await requestGraphQL(CONTRIBUTION_SUMMARY_QUERY, { username });
    const user = isRecord(data) ? data.user : null;
    const collection = isRecord(user) ? user.contributionsCollection : null;
    const calendar = parseContributionSummary(isRecord(collection) ? collection.contributionCalendar : null);
    if (!calendar) return contributionCache?.data ?? null;

    contributionCache = { ts: Date.now(), data: calendar };
    return calendar;
  } catch {
    return contributionCache?.data ?? null;
  }
}
