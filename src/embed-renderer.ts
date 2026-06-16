import { Issue, MergeRequest } from "./api-client";
import {
  ellipsize,
  formatDate,
  formatMergeStateEmoji,
  formatMergeStateLabel,
  formatMergeStateMeta,
  formatPipelineEmoji,
  formatPipelineMeta,
  formatPipelineStatus,
  renderStatusBlock,
} from "./embed-formatters";
import { GitLabURL } from "./gitlab-url";

function setupEmbedElement(
  embedElement: HTMLElement,
  href: string,
  cls: string,
): void {
  embedElement.classList.add("gitlab-embed", cls);
  embedElement.setAttribute("href", href);
  embedElement.setAttribute("target", "_blank");
  embedElement.setAttribute("rel", "noopener nofollow");
}

function populateIssueEmbed(
  embedElement: HTMLElement,
  issue: Issue,
  baseUrls: string[],
): void {
  setupEmbedElement(embedElement, issue.webUrl, "gitlab-issue");

  const { group, project } = new GitLabURL(issue.webUrl, baseUrls);
  embedElement.createEl("div", {
    text: `${group}/${project}`,
    cls: "gitlab-repo",
  });

  const headingElement = embedElement.createEl("div", {
    cls: "gitlab-heading",
  });

  headingElement.createEl("span", {
    text: "#" + issue.iid + " ",
    cls: "gitlab-identifier",
  });
  headingElement.appendText(issue.title);

  const detailsElement = embedElement.createDiv({ cls: "gitlab-details" });

  const authorElement = detailsElement.createEl("div", {
    cls: "gitlab-author",
  });
  const authorAvatarElement = authorElement.createEl("img", {
    cls: "gitlab-author-avatar",
  });
  authorAvatarElement.src = issue.author.avatarUrl;
  authorElement.appendText(issue.author.username);

  detailsElement.createEl("div", {
    text: formatDate(issue.createdAt),
    cls: "gitlab-date",
  });

  const labelsElement = detailsElement.createEl("div", {
    cls: "gitlab-labels",
  });

  issue.labels.slice(0, 3).forEach((label) =>
    labelsElement.createEl("div", {
      text: ellipsize(label, 20),
      cls: "gitlab-label",
    }),
  );
}

function populateMergeRequestEmbed(
  embedElement: HTMLElement,
  mergeRequest: MergeRequest,
  baseUrls: string[],
): void {
  setupEmbedElement(embedElement, mergeRequest.webUrl, "gitlab-merge-request");

  const bodyElement = embedElement.createDiv({ cls: "gitlab-embed-body" });
  const mainElement = bodyElement.createDiv({ cls: "gitlab-embed-main" });

  const { group, project } = new GitLabURL(mergeRequest.webUrl, baseUrls);
  mainElement.createEl("div", {
    text: `${group}/${project}`,
    cls: "gitlab-repo",
  });

  const headingElement = mainElement.createEl("div", {
    cls: "gitlab-heading",
  });
  headingElement.createEl("span", {
    text: "!" + mergeRequest.iid + " ",
    cls: "gitlab-identifier",
  });
  headingElement.appendText(mergeRequest.title);

  const detailsElement = mainElement.createDiv({ cls: "gitlab-details" });

  const authorElement = detailsElement.createEl("div", {
    cls: "gitlab-author",
  });
  const authorAvatarElement = authorElement.createEl("img", {
    cls: "gitlab-author-avatar",
  });
  authorAvatarElement.src = mergeRequest.author.avatarUrl;
  authorElement.appendText(mergeRequest.author.username);

  detailsElement.createEl("div", {
    text: `${mergeRequest.sourceBranch} → ${mergeRequest.targetBranch}`,
    cls: "gitlab-date",
  });

  detailsElement.createEl("div", {
    text: formatDate(mergeRequest.createdAt),
    cls: "gitlab-date",
  });

  const labelsElement = detailsElement.createEl("div", {
    cls: "gitlab-labels",
  });

  mergeRequest.labels.slice(0, 3).forEach((label) =>
    labelsElement.createEl("div", {
      text: ellipsize(label, 20),
      cls: "gitlab-label",
    }),
  );

  const asideElement = bodyElement.createDiv({ cls: "gitlab-embed-aside" });

  renderStatusBlock(asideElement, {
    modifier: mergeRequest.state,
    emoji: formatMergeStateEmoji(mergeRequest.state),
    label: formatMergeStateLabel(mergeRequest.state),
    meta: formatMergeStateMeta(mergeRequest),
  });

  if (mergeRequest.headPipeline) {
    const pipeline = mergeRequest.headPipeline;
    const { status } = pipeline;
    const meta = formatPipelineMeta(pipeline);

    renderStatusBlock(asideElement, {
      modifier: status,
      emoji: formatPipelineEmoji(status),
      label: formatPipelineStatus(status),
      meta: meta || undefined,
      title: pipeline.webUrl
        ? `Pipeline ${meta || formatPipelineStatus(status)}`
        : undefined,
    });
  }
}

export type EmbedData = Issue | MergeRequest;

export function renderEmbedInto(
  embedElement: HTMLElement,
  baseUrls: string[],
  data: EmbedData,
): void {
  embedElement.empty();
  embedElement.removeClass("gitlab-embed-loading");

  if ("sourceBranch" in data) {
    populateMergeRequestEmbed(embedElement, data, baseUrls);
    return;
  }

  populateIssueEmbed(embedElement, data, baseUrls);
}

export function renderEmbedElement(
  baseUrls: string[],
  data: EmbedData,
): HTMLElement {
  const embedElement = document.createElement("a");
  renderEmbedInto(embedElement, baseUrls, data);
  return embedElement;
}
