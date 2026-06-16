import { MergeRequest } from "./api-client";

export const ellipsize = (str: string, count: number): string => {
  if (str.length <= count) {
    return str;
  }

  const ellipses = "...";

  return str.slice(0, count - ellipses.length).trimEnd() + ellipses;
};

const pipelineStatusEmojis: Record<string, string> = {
  success: "✅",
  failed: "❌",
  running: "🔄",
  pending: "⏳",
  canceled: "🚫",
  cancelled: "🚫",
  skipped: "⏭️",
};

const pipelineStatusLabels: Record<string, string> = {
  success: "Passed",
  failed: "Failed",
  running: "Running",
  pending: "Pending",
  canceled: "Canceled",
  cancelled: "Canceled",
  skipped: "Skipped",
};

export const formatPipelineStatus = (status: string): string => {
  return pipelineStatusLabels[status] ?? status;
};

export const formatPipelineEmoji = (status: string): string => {
  return pipelineStatusEmojis[status] ?? "⚙️";
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const formatPipelineMeta = (
  pipeline: NonNullable<MergeRequest["headPipeline"]>,
): string => {
  const parts: string[] = [];

  if (pipeline.iid !== undefined) {
    parts.push(`#${pipeline.iid}`);
  }

  if (pipeline.duration !== undefined) {
    parts.push(formatDuration(pipeline.duration));
  }

  if (pipeline.finishedAt) {
    parts.push(formatDate(pipeline.finishedAt));
  }

  return parts.join(" · ");
};

export const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const mergeStateEmojis: Record<string, string> = {
  opened: "🟢",
  merged: "🔀",
  closed: "🔒",
  locked: "🔒",
};

const mergeStateLabels: Record<string, string> = {
  opened: "Open",
  merged: "Merged",
  closed: "Closed",
  locked: "Locked",
};

export const formatMergeStateEmoji = (state: string): string => {
  return mergeStateEmojis[state] ?? "📋";
};

export const formatMergeStateLabel = (state: string): string => {
  return mergeStateLabels[state] ?? state;
};

export const formatMergeStateMeta = (mergeRequest: MergeRequest): string => {
  if (mergeRequest.state === "merged" && mergeRequest.mergedAt) {
    return formatDate(mergeRequest.mergedAt);
  }

  if (mergeRequest.state === "closed" && mergeRequest.closedAt) {
    return formatDate(mergeRequest.closedAt);
  }

  if (mergeRequest.state === "opened") {
    return formatDate(mergeRequest.createdAt);
  }

  return "";
};

export function renderStatusBlock(
  parent: HTMLElement,
  options: {
    modifier: string;
    emoji: string;
    label: string;
    meta?: string;
    title?: string;
  },
): void {
  const block = parent.createDiv({
    cls: `gitlab-status-block gitlab-status-block--${options.modifier}`,
  });

  const statusRow = block.createDiv({ cls: "gitlab-status-block-row" });
  statusRow.createEl("span", {
    text: options.emoji,
    cls: "gitlab-status-block-emoji",
  });
  statusRow.createEl("span", {
    text: options.label,
    cls: "gitlab-status-block-label",
  });

  if (options.meta) {
    block.createEl("div", {
      text: options.meta,
      cls: "gitlab-status-block-meta",
    });
  }

  if (options.title) {
    block.setAttr("title", options.title);
  }
}
