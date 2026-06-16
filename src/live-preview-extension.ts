/* eslint-disable import/no-extraneous-dependencies -- CodeMirror modules are provided by Obsidian at runtime */
import { ensureSyntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  PluginSpec,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import {
  loadMrDiscussInto,
  MR_DISCUSS_CODE_BLOCK,
} from "./discuss-block-processor";
import {
  collectFencedCodeBlocks,
  isInsideFencedCode,
  parseFirstNonEmptyLine,
  rangesOverlap,
} from "./fenced-code";
import {
  fetchEmbed,
  getBaseUrls,
  getUnconfiguredInstanceMessage,
  GitLabEmbedHost,
  isGitLabEmbedUrl,
  looksLikeGitLabEmbedUrl,
} from "./embed-service";
import { renderEmbedInto } from "./embed-renderer";

type EmbedCandidate = {
  from: number;
  to: number;
  href: string;
  kind: "link" | "discuss";
};

const BARE_URL_PATTERN = /https?:\/\/[^\s)\]<>]+/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/;

function selectionOverlapsRange(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  return view.state.selection.ranges.some(
    (range) => range.from <= to && range.to >= from,
  );
}

function isVisibleLine(
  lineFrom: number,
  lineTo: number,
  visibleFrom: number,
  visibleTo: number,
): boolean {
  return lineTo >= visibleFrom && lineFrom <= visibleTo;
}

function collectLinkEmbedCandidates(view: EditorView): EmbedCandidate[] {
  const candidates: EmbedCandidate[] = [];
  const visibleFrom = view.visibleRanges[0]?.from ?? 0;
  const visibleTo =
    view.visibleRanges[view.visibleRanges.length - 1]?.to ??
    view.state.doc.length;

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber++) {
    const line = view.state.doc.line(lineNumber);
    if (!isVisibleLine(line.from, line.to, visibleFrom, visibleTo)) {
      continue;
    }

    ensureSyntaxTree(view.state, line.to, 500);

    const markdownLinkMatch = line.text.match(MARKDOWN_LINK_PATTERN);
    if (markdownLinkMatch) {
      const fullMatch = markdownLinkMatch[0];
      const href = markdownLinkMatch[2] ?? "";
      if (!looksLikeGitLabEmbedUrl(href)) {
        continue;
      }

      const start = line.from + line.text.indexOf(fullMatch);
      const end = start + fullMatch.length;
      if (isInsideFencedCode(view, start)) {
        continue;
      }
      if (selectionOverlapsRange(view, start, end)) {
        continue;
      }

      candidates.push({ from: start, to: end, href, kind: "link" });
      continue;
    }

    BARE_URL_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BARE_URL_PATTERN.exec(line.text)) !== null) {
      const href = match[0];
      if (!looksLikeGitLabEmbedUrl(href)) {
        continue;
      }

      const start = line.from + match.index;
      const end = start + href.length;
      if (isInsideFencedCode(view, start)) {
        continue;
      }
      if (selectionOverlapsRange(view, start, end)) {
        continue;
      }

      candidates.push({ from: start, to: end, href, kind: "link" });
    }
  }

  return candidates;
}

function collectDiscussBlockCandidates(view: EditorView): EmbedCandidate[] {
  const candidates: EmbedCandidate[] = [];
  const visibleFrom = view.visibleRanges[0]?.from ?? 0;
  const visibleTo =
    view.visibleRanges[view.visibleRanges.length - 1]?.to ??
    view.state.doc.length;

  ensureSyntaxTree(view.state, visibleTo, 500);

  for (const block of collectFencedCodeBlocks(view, visibleFrom, visibleTo)) {
    if (block.language !== MR_DISCUSS_CODE_BLOCK) {
      continue;
    }

    const href = parseFirstNonEmptyLine(block.content);
    if (!href) {
      continue;
    }

    if (selectionOverlapsRange(view, block.from, block.to)) {
      continue;
    }

    candidates.push({
      from: block.from,
      to: block.to,
      href,
      kind: "discuss",
    });
  }

  return candidates;
}

function collectLivePreviewCandidates(view: EditorView): EmbedCandidate[] {
  const discussCandidates = collectDiscussBlockCandidates(view);
  const linkCandidates = collectLinkEmbedCandidates(view).filter(
    (link) =>
      !discussCandidates.some((discuss) =>
        rangesOverlap(link.from, link.to, discuss.from, discuss.to),
      ),
  );

  return [...discussCandidates, ...linkCandidates].sort(
    (a, b) => a.from - b.from,
  );
}

class GitLabEmbedWidget extends WidgetType {
  private loadVersion = 0;

  constructor(
    private href: string,
    private host: GitLabEmbedHost,
  ) {
    super();
  }

  eq(other: GitLabEmbedWidget): boolean {
    return other.href === this.href;
  }

  toDOM(): HTMLElement {
    const embedElement = document.createElement("a");
    embedElement.classList.add("gitlab-embed", "gitlab-embed-loading");
    embedElement.setAttribute("href", this.href);
    embedElement.setAttribute("target", "_blank");
    embedElement.setAttribute("rel", "noopener nofollow");

    const baseUrls = getBaseUrls(this.host);
    if (!isGitLabEmbedUrl(this.href, baseUrls)) {
      const message =
        getUnconfiguredInstanceMessage(this.href, baseUrls) ??
        "Unsupported GitLab URL.";
      embedElement.setText(message);
      embedElement.removeClass("gitlab-embed-loading");
      return embedElement;
    }

    embedElement.setText("Loading GitLab embed…");
    void this.loadEmbed(embedElement);
    return embedElement;
  }

  private async loadEmbed(embedElement: HTMLElement): Promise<void> {
    const version = ++this.loadVersion;
    const data = await fetchEmbed(this.host, this.href);
    if (version !== this.loadVersion || !data) {
      if (version === this.loadVersion && embedElement.isConnected) {
        embedElement.empty();
        embedElement.setText("Unable to load GitLab embed.");
        embedElement.removeClass("gitlab-embed-loading");
      }
      return;
    }

    if (!embedElement.isConnected) {
      return;
    }

    renderEmbedInto(embedElement, getBaseUrls(this.host), data);
  }
}

class GitLabDiscussWidget extends WidgetType {
  private loadVersion = 0;

  constructor(
    private href: string,
    private host: GitLabEmbedHost,
  ) {
    super();
  }

  eq(other: GitLabDiscussWidget): boolean {
    return other.href === this.href;
  }

  toDOM(): HTMLElement {
    const container = document.createElement("a");
    container.classList.add(
      "gitlab-embed",
      "gitlab-mr-discuss-block",
      "gitlab-embed-loading",
    );
    container.setAttribute("href", this.href);
    container.setAttribute("target", "_blank");
    container.setAttribute("rel", "noopener nofollow");
    container.setText("Loading MR discussions…");
    void this.loadDiscuss(container);
    return container;
  }

  private async loadDiscuss(container: HTMLElement): Promise<void> {
    const version = ++this.loadVersion;
    await loadMrDiscussInto(this.host, this.href, container);
    if (version !== this.loadVersion || !container.isConnected) {
      return;
    }
  }
}

function createGitLabLivePreviewPlugin(host: GitLabEmbedHost) {
  class GitLabLivePreviewPlugin implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    destroy() {}

    private buildDecorations(view: EditorView): DecorationSet {
      if (!view.state.field(editorLivePreviewField)) {
        return Decoration.none;
      }

      const builder = new RangeSetBuilder<Decoration>();
      const candidates = collectLivePreviewCandidates(view);

      for (const candidate of candidates) {
        if (candidate.kind === "discuss") {
          builder.add(
            candidate.from,
            candidate.to,
            Decoration.replace({
              widget: new GitLabDiscussWidget(candidate.href, host),
              block: true,
            }),
          );
          continue;
        }

        builder.add(
          candidate.from,
          candidate.to,
          Decoration.replace({
            widget: new GitLabEmbedWidget(candidate.href, host),
          }),
        );
      }

      return builder.finish();
    }
  }

  const pluginSpec: PluginSpec<GitLabLivePreviewPlugin> = {
    decorations: (value: GitLabLivePreviewPlugin) => value.decorations,
  };

  return ViewPlugin.fromClass(GitLabLivePreviewPlugin, pluginSpec);
}

export function createGitLabLivePreviewExtension(host: GitLabEmbedHost) {
  return createGitLabLivePreviewPlugin(host);
}
