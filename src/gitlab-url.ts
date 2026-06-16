import { normalizeBaseUrl } from "./settings";

export enum GitLabResource {
  ISSUE = "issues",
  MERGE_REQUEST = "merge_requests",
}

export class GitLabURL {
  url: string;
  baseURL: string;
  group: string;
  project: string;
  resource: GitLabResource;
  id: string;

  constructor(url: string, validBaseURLs: string[]) {
    const normalizedValidBaseURLs = validBaseURLs.map(normalizeBaseUrl);
    const baseURL = normalizedValidBaseURLs.find((b) =>
      normalizeBaseUrl(url).startsWith(b),
    );
    if (!baseURL)
      throw new TypeError(
        "URL does not match any configured GitLab instances: " + url,
      );

    const pathToMatch = url.substring(baseURL.length);

    const pattern = /^\/(.+?)\/([^/]+)\/-\/([^/]+)\/(\d+)/;
    const match = pattern.exec(pathToMatch);

    if (match === null) throw new TypeError(`Invalid GitLab URL: ${url}`);
    if (match.length !== 5)
      throw new TypeError(`Wrong format GitLab URL: ${url}`);

    this.url = url;
    this.baseURL = baseURL;
    this.group = match[1] as string;
    this.project = match[2] as string;
    this.resource = match[3] as GitLabResource;
    this.id = match[4] as string;
  }

  getProjectId() {
    return `${this.group}%2f${this.project}`;
  }
}

export function parseGitLabUrl(
  href: string,
  baseUrls: string[],
): GitLabURL | null {
  try {
    return new GitLabURL(href, baseUrls);
  } catch {
    return null;
  }
}

const GITLAB_EMBED_PATH_PATTERN =
  /^(https?:\/\/[^/]+)\/(.+?)\/([^/]+)\/-\/(issues|merge_requests)\/(\d+)/;

export function matchGitLabEmbedPath(href: string): string | null {
  const match = GITLAB_EMBED_PATH_PATTERN.exec(href.trim());
  if (!match) return null;
  return match[1] ?? null;
}
