import { Notice } from "obsidian";
import {
  GitLabAPIClient,
  GitLabApiError,
  MergeRequest,
  MergeRequestDiscussion,
} from "./api-client";
import { GitLabResource, GitLabURL, parseGitLabUrl } from "./gitlab-url";
import { getBaseUrls, GitLabEmbedHost } from "./embed-service";

export type { GitLabEmbedHost };
export { getBaseUrls };

export type MrDiscussData = {
  mergeRequest: MergeRequest;
  discussions: MergeRequestDiscussion[];
};

const discussCache = new Map<string, MrDiscussData>();

export function clearDiscussCache(): void {
  discussCache.clear();
}

function getClient(
  host: GitLabEmbedHost,
  baseURL: string,
): GitLabAPIClient | undefined {
  return host.clients[baseURL];
}

export function handleGitLabAuthError(e: unknown): void {
  if (e instanceof GitLabApiError && (e.status === 401 || e.status === 403)) {
    new Notice(
      "GitLab embed: configure authentication (PAT or OAuth) in settings.",
      8000,
    );
  }
}

export function parseMrDiscussUrl(
  href: string,
  baseUrls: string[],
): GitLabURL | null {
  const url = parseGitLabUrl(href.trim(), baseUrls);
  if (!url || url.resource !== GitLabResource.MERGE_REQUEST) {
    return null;
  }
  return url;
}

export async function fetchMrDiscuss(
  host: GitLabEmbedHost,
  href: string,
): Promise<MrDiscussData | null> {
  const trimmedHref = href.trim();
  const cached = discussCache.get(trimmedHref);
  if (cached) {
    return cached;
  }

  const baseUrls = getBaseUrls(host);
  const url = parseMrDiscussUrl(trimmedHref, baseUrls);
  if (!url) {
    return null;
  }

  const client = getClient(host, url.baseURL);
  if (!client) {
    return null;
  }

  try {
    const projectId = url.getProjectId();
    const [mergeRequest, discussions] = await Promise.all([
      client.getProjectMergeRequest(projectId, url.id),
      client.getProjectMergeRequestDiscussions(projectId, url.id),
    ]);

    const data: MrDiscussData = { mergeRequest, discussions };
    discussCache.set(trimmedHref, data);
    return data;
  } catch (e) {
    handleGitLabAuthError(e);
    return null;
  }
}
