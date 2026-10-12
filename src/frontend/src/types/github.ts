/*
 * GitHub GraphQL shapes.
 *
 * Server-only: imported by `services/github.ts`, which runs during the render of
 * `/coding`. Nothing here may be reachable from a browser bundle.
 *
 * These mirror the queries in `services/github.ts`. They are typed by
 * hand because springdoc describes the Spring API, not the third-party GraphQL
 * responses this page fetches.
 */
export interface PinnedRepo {
  id: string;
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  primaryLanguage: { name: string } | null;
  repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
}

export interface ContributionSummary {
  totalContributions: number;
  weeks: Array<{
    contributionDays: Array<{
      color: string;
      contributionCount: number;
      date: string;
      weekday: number;
    }>;
  }>;
}

/** One row as `/coding` renders it, after the GraphQL shape has been flattened. */
export interface RepoView {
  index: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  imageSrc: string | null;
  githubUrl: string;
}
