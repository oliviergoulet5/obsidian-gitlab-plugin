import {
  MergeRequest,
  MergeRequestDiscussion,
  MergeRequestDiscussionNote,
  MergeRequestDiscussionNotePosition,
} from "./api-client";
import {
  formatDate,
  formatMergeStateEmoji,
  formatMergeStateLabel,
  formatMergeStateMeta,
  renderStatusBlock,
} from "./embed-formatters";
import { GitLabURL } from "./gitlab-url";
import { MrDiscussData } from "./discuss-service";

export type VisibleDiscussion = {
  id: string;
  notes: MergeRequestDiscussionNote[];
  position?: MergeRequestDiscussionNotePosition;
  resolved: boolean;
  resolvable: boolean;
};

function filterVisibleNotes(
  discussion: MergeRequestDiscussion,
): MergeRequestDiscussionNote[] {
  return discussion.notes.filter((note) => !note.system);
}

export function prepareVisibleDiscussions(
  discussions: MergeRequestDiscussion[],
): VisibleDiscussion[] {
  const visible: VisibleDiscussion[] = [];

  for (const discussion of discussions) {
    const notes = filterVisibleNotes(discussion);
    if (notes.length === 0) {
      continue;
    }

    const position = notes.find((note) => note.position)?.position;

    visible.push({
      id: discussion.id,
      notes,
      position,
      resolved: notes.some((note) => note.resolvable && note.resolved),
      resolvable: notes.some((note) => note.resolvable),
    });
  }

  visible.sort((a, b) => {
    const aDate = a.notes[0]?.createdAt ?? "";
    const bDate = b.notes[0]?.createdAt ?? "";
    return bDate.localeCompare(aDate);
  });

  return visible;
}

function formatDiscussionPosition(
  position: MergeRequestDiscussionNotePosition,
): string {
  const filePath = position.newPath ?? position.oldPath;
  if (!filePath) {
    return "";
  }

  const line = position.newLine ?? position.oldLine;
  return line !== undefined ? `${filePath}:${line}` : filePath;
}

function renderDiscussionNote(
  parent: HTMLElement,
  note: MergeRequestDiscussionNote,
  isReply: boolean,
): void {
  const noteElement = parent.createDiv({
    cls: isReply
      ? "gitlab-mr-discuss-note gitlab-mr-discuss-reply"
      : "gitlab-mr-discuss-note",
  });

  const headerElement = noteElement.createDiv({
    cls: "gitlab-mr-discuss-note-header",
  });

  const authorElement = headerElement.createDiv({
    cls: "gitlab-author",
  });
  const avatarElement = authorElement.createEl("img", {
    cls: "gitlab-author-avatar",
  });
  avatarElement.src = note.author.avatarUrl;
  authorElement.appendText(note.author.username);

  headerElement.createEl("div", {
    text: formatDate(note.createdAt),
    cls: "gitlab-date",
  });

  noteElement.createEl("div", {
    text: note.body,
    cls: "gitlab-mr-discuss-body",
  });
}

function renderCompactMrHeader(
  parent: HTMLElement,
  mergeRequest: MergeRequest,
  baseUrls: string[],
): void {
  const headerElement = parent.createDiv({ cls: "gitlab-mr-discuss-header" });
  const mainElement = headerElement.createDiv({
    cls: "gitlab-mr-discuss-header-main",
  });

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

  const asideElement = headerElement.createDiv({
    cls: "gitlab-mr-discuss-header-aside",
  });
  renderStatusBlock(asideElement, {
    modifier: mergeRequest.state,
    emoji: formatMergeStateEmoji(mergeRequest.state),
    label: formatMergeStateLabel(mergeRequest.state),
    meta: formatMergeStateMeta(mergeRequest),
  });
}

function renderDiscussionSummary(
  parent: HTMLElement,
  threads: VisibleDiscussion[],
): void {
  const unresolvedCount = threads.filter(
    (thread) => thread.resolvable && !thread.resolved,
  ).length;
  const threadLabel = threads.length === 1 ? "thread" : "threads";
  const summaryParts = [`${threads.length} ${threadLabel}`];

  if (unresolvedCount > 0) {
    summaryParts.push(`${unresolvedCount} unresolved`);
  }

  parent.createEl("div", {
    text: summaryParts.join(" · "),
    cls: "gitlab-mr-discuss-summary",
  });
}

function renderDiscussionThreads(
  parent: HTMLElement,
  threads: VisibleDiscussion[],
): void {
  const threadsElement = parent.createDiv({ cls: "gitlab-mr-discuss-threads" });

  for (const thread of threads) {
    const threadElement = threadsElement.createDiv({
      cls: "gitlab-mr-discuss-thread",
    });

    const metaElement = threadElement.createDiv({
      cls: "gitlab-mr-discuss-thread-meta",
    });

    if (thread.position) {
      const positionText = formatDiscussionPosition(thread.position);
      if (positionText) {
        metaElement.createEl("span", {
          text: positionText,
          cls: "gitlab-mr-discuss-position",
        });
      }
    }

    if (thread.resolvable && thread.resolved) {
      metaElement.createEl("span", {
        text: "Resolved",
        cls: "gitlab-mr-discuss-resolved",
      });
    }

    thread.notes.forEach((note, index) => {
      renderDiscussionNote(threadElement, note, index > 0);
    });
  }
}

export function renderMrDiscussInto(
  container: HTMLElement,
  baseUrls: string[],
  data: MrDiscussData,
): void {
  container.empty();
  container.removeClass("gitlab-embed-loading");
  container.classList.add("gitlab-mr-discuss");

  renderCompactMrHeader(container, data.mergeRequest, baseUrls);

  const threads = prepareVisibleDiscussions(data.discussions);
  if (threads.length === 0) {
    container.createEl("div", {
      text: "No comments",
      cls: "gitlab-mr-discuss-empty",
    });
    return;
  }

  renderDiscussionSummary(container, threads);
  renderDiscussionThreads(container, threads);
}

export function renderMrDiscussElement(
  baseUrls: string[],
  data: MrDiscussData,
  href: string,
): HTMLElement {
  const container = document.createElement("a");
  container.classList.add("gitlab-embed", "gitlab-mr-discuss-block");
  container.setAttribute("href", href);
  container.setAttribute("target", "_blank");
  container.setAttribute("rel", "noopener nofollow");
  renderMrDiscussInto(container, baseUrls, data);
  return container;
}

export function renderMrDiscussError(
  container: HTMLElement,
  message: string,
): void {
  container.empty();
  container.removeClass("gitlab-embed-loading");
  container.classList.add("gitlab-mr-discuss", "gitlab-mr-discuss-error");
  container.createEl("div", { text: message, cls: "gitlab-mr-discuss-empty" });
}
