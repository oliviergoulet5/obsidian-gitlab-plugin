import {
  fetchMrDiscuss,
  getBaseUrls,
  GitLabEmbedHost,
  parseMrDiscussUrl,
} from "./discuss-service";
import {
  renderMrDiscussElement,
  renderMrDiscussError,
  renderMrDiscussInto,
} from "./discuss-renderer";
import {
  getUnconfiguredInstanceMessage,
  isGitLabEmbedUrl,
  looksLikeGitLabEmbedUrl,
} from "./embed-service";
import { parseFirstNonEmptyLine } from "./fenced-code";

export const MR_DISCUSS_CODE_BLOCK = "gitlab-mr-discuss";

function parseMrDiscussSource(source: string): string {
  return parseFirstNonEmptyLine(source);
}

export async function processMrDiscussCodeBlock(
  host: GitLabEmbedHost,
  source: string,
  container: HTMLElement,
): Promise<void> {
  const href = parseMrDiscussSource(source);
  container.classList.add("gitlab-embed", "gitlab-mr-discuss-block");

  if (!href) {
    renderMrDiscussError(container, "Add a merge request URL to this block.");
    return;
  }

  if (!looksLikeGitLabEmbedUrl(href)) {
    renderMrDiscussError(container, "Invalid GitLab merge request URL.");
    return;
  }

  const baseUrls = getBaseUrls(host);
  if (!isGitLabEmbedUrl(href, baseUrls)) {
    renderMrDiscussError(
      container,
      getUnconfiguredInstanceMessage(href, baseUrls) ??
        "Unsupported GitLab URL.",
    );
    return;
  }

  if (!parseMrDiscussUrl(href, baseUrls)) {
    renderMrDiscussError(
      container,
      "This block requires a merge request URL, not an issue URL.",
    );
    return;
  }

  container.classList.add("gitlab-embed-loading");
  container.setText("Loading MR discussions…");

  const data = await fetchMrDiscuss(host, href);
  if (!data) {
    renderMrDiscussError(
      container,
      "Unable to load merge request discussions.",
    );
    return;
  }

  const linkElement = renderMrDiscussElement(baseUrls, data, href);
  container.replaceWith(linkElement);
}

export async function loadMrDiscussInto(
  host: GitLabEmbedHost,
  href: string,
  container: HTMLElement,
): Promise<void> {
  const baseUrls = getBaseUrls(host);
  container.classList.add("gitlab-embed", "gitlab-mr-discuss-block");
  container.setAttribute("href", href);
  container.setAttribute("target", "_blank");
  container.setAttribute("rel", "noopener nofollow");

  if (!looksLikeGitLabEmbedUrl(href)) {
    renderMrDiscussError(container, "Invalid GitLab merge request URL.");
    return;
  }

  if (!isGitLabEmbedUrl(href, baseUrls)) {
    renderMrDiscussError(
      container,
      getUnconfiguredInstanceMessage(href, baseUrls) ??
        "Unsupported GitLab URL.",
    );
    return;
  }

  if (!parseMrDiscussUrl(href, baseUrls)) {
    renderMrDiscussError(
      container,
      "This block requires a merge request URL, not an issue URL.",
    );
    return;
  }

  const data = await fetchMrDiscuss(host, href);
  if (!data) {
    renderMrDiscussError(
      container,
      "Unable to load merge request discussions.",
    );
    return;
  }

  renderMrDiscussInto(container, baseUrls, data);
}
