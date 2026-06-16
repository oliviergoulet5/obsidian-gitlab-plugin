import { Notice } from "obsidian";
import {
  GitLabAPIClient,
  GitLabApiError,
  Issue,
  MergeRequest,
} from "./api-client";
import { EmbedData, renderEmbedElement } from "./embed-renderer";
import {
  GitLabResource,
  GitLabURL,
  matchGitLabEmbedPath,
  parseGitLabUrl,
} from "./gitlab-url";
import { GitLabPluginSettings } from "./settings";

export interface GitLabEmbedHost {
  settings: GitLabPluginSettings;
  clients: Record<string, GitLabAPIClient>;
}

const embedCache = new Map<string, EmbedData>();

export function clearEmbedCache(): void {
  embedCache.clear();
}

export function getBaseUrls(host: GitLabEmbedHost): string[] {
  return host.settings.instances.map((i) => i.baseUrl);
}

function getClient(
  host: GitLabEmbedHost,
  baseURL: string,
): GitLabAPIClient | undefined {
  return host.clients[baseURL];
}

function handleAuthError(e: unknown): void {
  if (e instanceof GitLabApiError && (e.status === 401 || e.status === 403)) {
    new Notice(
      "GitLab embed: configure authentication (PAT or OAuth) in settings.",
      8000,
    );
  }
}

async function fetchEmbedData(
  host: GitLabEmbedHost,
  url: GitLabURL,
): Promise<EmbedData | null> {
  const client = getClient(host, url.baseURL);
  if (!client) return null;

  try {
    switch (url.resource) {
      case GitLabResource.ISSUE: {
        return await client.getProjectIssue(url.getProjectId(), url.id);
      }
      case GitLabResource.MERGE_REQUEST: {
        return await client.getProjectMergeRequest(url.getProjectId(), url.id);
      }
    }
  } catch (e) {
    handleAuthError(e);
    return null;
  }
}

export async function fetchEmbed(
  host: GitLabEmbedHost,
  href: string,
): Promise<EmbedData | null> {
  const cached = embedCache.get(href);
  if (cached) {
    return cached;
  }

  const baseUrls = getBaseUrls(host);
  const url = parseGitLabUrl(href, baseUrls);
  if (!url) return null;

  const data = await fetchEmbedData(host, url);
  if (data) {
    embedCache.set(href, data);
  }

  return data;
}

export async function processAnchorElement(
  host: GitLabEmbedHost,
  anchorElement: HTMLAnchorElement,
): Promise<void> {
  if (anchorElement.closest("pre, code")) {
    return;
  }

  const baseUrls = getBaseUrls(host);
  const url = parseGitLabUrl(anchorElement.href, baseUrls);
  if (!url) return;

  const data = await fetchEmbed(host, anchorElement.href);
  if (!data) return;

  const embedElement = renderEmbedElement(baseUrls, data);
  anchorElement.replaceWith(embedElement);
}

export function isGitLabEmbedUrl(href: string, baseUrls: string[]): boolean {
  return parseGitLabUrl(href, baseUrls) !== null;
}

export function looksLikeGitLabEmbedUrl(href: string): boolean {
  return matchGitLabEmbedPath(href) !== null;
}

export function getUnconfiguredInstanceMessage(
  href: string,
  baseUrls: string[],
): string | null {
  if (parseGitLabUrl(href, baseUrls)) {
    return null;
  }

  const baseUrl = matchGitLabEmbedPath(href);
  if (!baseUrl) {
    return null;
  }

  return `Add ${baseUrl} in Settings → GitLab Embeds.`;
}

export type { Issue, MergeRequest };
