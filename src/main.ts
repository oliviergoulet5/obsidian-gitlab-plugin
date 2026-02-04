import { App, Editor, MarkdownView, requestUrl, Modal, Notice, Plugin, addIcon } from "obsidian";
import { DEFAULT_SETTINGS, GitLabPluginSettings, GitLabSettingTab } from "./settings";
import { GitLabAPIClient } from "./api-client";

enum GitLabResource {
  ISSUE = "issues",
  MERGE_REQUEST = "merge_request",
}

type BaseEmbedOptions = {
  href: string;
  clses: string | string[];
}

const client = new GitLabAPIClient();

const BASEURL = "https://gitlab.com"; // TODO: Support self-hosted

export default class GitLabPlugin extends Plugin {
  settings: GitLabPluginSettings;

  async onload() {
    await this.loadSettings();

    this.registerMarkdownPostProcessor(async (element, context) => {
      // Query all the anchor tags in the document and process them.
      const anchorElements = Array.from(element.querySelectorAll("a"));
      await Promise.all(anchorElements.map(anchorElement => this.processAnchor(anchorElement)));
    });
  }

  onunload() {
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<GitLabPluginSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async processAnchor(anchorElement: HTMLAnchorElement): Promise<void> {
    const url = new GitLabURL(anchorElement.href);
    const embedParentElement = anchorElement.parentElement as HTMLElement;

    switch (url.resource) {
      case GitLabResource.ISSUE:
        await this.renderIssueEmbed(embedParentElement, url);
        break;
      case GitLabResource.MERGE_REQUEST:
        console.debug("Merge request identified");
        break;
      default:
        break;
    }
  }

  /**
   * Renders the base of an embed. All embeds are built upon this.
   * @param container - The parent element
   * @param options - Options
   * @returns The base embed.
   */
  private renderBaseEmbed(container: HTMLElement, options: BaseEmbedOptions): HTMLElement {
    const embedElement = container.createEl("a"); 
    embedElement.classList.add("gitlab-embed");

    embedElement.setAttribute("href", options.href);
    embedElement.setAttribute("target", "_blank");
    embedElement.setAttribute("rel", "noopener nofollow");
    
    embedElement.addClass("gitlab-embed");
    embedElement.addClasses(Array.isArray(options.clses) ? options.clses : [options.clses]);

    return embedElement;
  }

  /**
   * Renders an issue embed.
   * @param element - The parent element
   * @param url - The GitLab URL to the issue
   */
  private async renderIssueEmbed(element: HTMLElement, url: GitLabURL): Promise<void> {
    const issue = await client.getProjectIssue(url.getProjectId(), url.id);

    const embedElement = this.renderBaseEmbed(element, { href: url.url, clses: ["gitlab-issue"] });

    const repoElement = embedElement.createEl("div", { text: `${url.group}/${url.project}` });
    repoElement.classList.add("gitlab-repo");

    const headingElement = embedElement.createEl("div", { cls: "gitlab-heading" });

    const identifierElement = headingElement.createEl("span", { text: '#' + url.id + " ", cls: "gitlab-identifier" });
    headingElement.appendText(issue.title);

    const detailsElement = embedElement.createDiv({ cls: "gitlab-details" });

    const authorElement = detailsElement.createEl("div", { cls: "gitlab-author" });
    const authorAvatarElement = authorElement.createEl("img", { cls: "gitlab-author-avatar" });
    authorAvatarElement.src = issue.author.avatarUrl;
    authorElement.appendText(issue.author.username);

    const date = new Date(issue.createdAt);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const dd = String(date.getDate()).padStart(2, '0');

    const dateElement = detailsElement.createEl("div", { text: `${yyyy}-${mm}-${dd}`, cls: "gitlab-date" });

    const labelsElement = detailsElement.createEl("div", { cls: "gitlab-labels" });
    
    issue.labels.slice(0, 3).forEach(label => labelsElement.createEl("div", { text: ellipsize(label, 20), cls: "gitlab-label" }));
    // TODO add +3 more text
  }
}

/**
 * Truncates text and appends ellipses if the character count exceeds
 * threshold.
 * @param str - the text to truncate
 * @param count - the threshold
 * @returns truncated text with ellipses or the full text if the text is
 * smaller in length than threshold.
 */
const ellipsize = (str: string, count: number): string => {
  if (str.length <= count) {
    return str;
  }

  const ellipses = "...";

  // Truncate text and append ellipses to meet the desired length.
  return str.slice(0, count - ellipses.length).trimEnd() + ellipses;
}

class GitLabURL {
  url: string;
  baseURL: string;
  group: string;
  project: string;
  resource: GitLabResource;
  id: string;

  constructor(url: string) {
    // This pattern breaks down a GitLab URL into the following parts:
    // 1. BaseURL
    // 2. Group
    // 3. Project
    // 4. Resource (e.g. issues, merge_requests)
    // 5. ID (e.g. 1, 2, 40)
    const pattern = new RegExp(
      /(https?:\/\/[^/]+)\/((?:[^/]+\/)*)([^/]+)\/-\/([^/]+)\/(\d+)/gm
    );
    const match = pattern.exec(url);
    
    if (match === null) throw new TypeError(`Invalid GitLab URL: ${url}`);
    console.debug(match);
    if (match.length !== 6) throw new TypeError(`Wrong format GitLab URL: ${url}`);
    
    this.url = match[0];
    this.baseURL = match[1] as string;
    this.group = (match[2] as string).slice(0, -1); // remove trailing slash
    this.project = match[3] as string;
    this.resource = match[4] as GitLabResource;
    this.id = match[5] as string;
  }

  getProjectId() {
    return `${this.group}%2f${this.project}`;
  }
}
