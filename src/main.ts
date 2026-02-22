import { Plugin } from "obsidian";
import {
  DEFAULT_SETTINGS,
  GitLabPluginSettings,
  GitLabSettingTab,
} from "./settings";
import { GitLabAPIClient, Issue } from "./api-client";

enum GitLabResource {
  ISSUE = "issues",
  MERGE_REQUEST = "merge_request",
}

type BaseEmbedOptions = {
  href: string;
  clses: string | string[];
};

// Key-value pairs where the keys are baseURLs and the value is the API client
// for that URL. This ensures that client lookup can be done quickly per URL
// encountered.
type GitLabAPIClientRecord = Record<string, GitLabAPIClient>;

export default class GitLabPlugin extends Plugin {
  settings: GitLabPluginSettings;
  clients: GitLabAPIClientRecord = {};

  async onload() {
    console.debug("onload");
    await this.loadSettings();
    this.addSettingTab(new GitLabSettingTab(this.app, this));
    this.reloadClients();

    // Register OAuth callback handler
    this.registerObsidianProtocolHandler("gitlab-embeds", async (data) => {
      const code = data.code as string;
      const state = data.state as string;
      console.debug("OAuth callback", code, state);

      // Find the instance that initiated this - for now assume first instance with clientId
      const instance = this.settings.instances.find((i) => i.clientId);
      const baseUrl = instance?.baseUrl;
      const client = baseUrl ? this.clients[baseUrl] : undefined;
      if (client && code && state) {
        await client.handleCallback(code, state);
        console.debug("OAuth success");
      }
    });

    this.registerMarkdownPostProcessor(async (element, context) => {
      // Query all the anchor tags in the document and process them.
      const anchorElements = Array.from(element.querySelectorAll("a"));
      await Promise.all(
        anchorElements.map((anchorElement) =>
          this.processAnchor(anchorElement),
        ),
      );
    });
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<GitLabPluginSettings>,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  reloadClients() {
    this.clients = {};
    this.settings.instances.forEach(
      (instance) =>
        (this.clients[instance.baseUrl] = new GitLabAPIClient({
          baseURL: instance.baseUrl,
          plugin: this,
          clientId: instance.clientId,
        })),
    );
  }

  private async processAnchor(anchorElement: HTMLAnchorElement): Promise<void> {
    let url: GitLabURL;
    try {
      const baseUrls = this.settings.instances.map((i) => i.baseUrl);
      url = new GitLabURL(anchorElement.href, baseUrls);
    } catch {
      // This anchor does not need to be processed further since it is not a
      // GitLab URL.
      return;
    }
    const embedParentElement = anchorElement.parentElement as HTMLElement;

    const client = this.getRelevantAPIClient(url.baseURL);
    if (!client) return;

    switch (url.resource) {
      case GitLabResource.ISSUE: {
        const issue = await client.getProjectIssue(url.getProjectId(), url.id);
        this.renderIssueEmbed(embedParentElement, issue);
        break;
      }
      case GitLabResource.MERGE_REQUEST: {
        break;
      }
      default: {
        break;
      }
    }
  }

  /**
   * Retrieve the API client relevant to the given base URL.
   *
   * This assumes that a valid baseURL has been given. Otherwise, it will error.
   *
   * @param baseURL The base URL of a GitLab instance
   * @throws
   */
  private getRelevantAPIClient(baseURL: string) {
    return this.clients[baseURL];
  }

  /**
   * Renders the base of an embed. All embeds are built upon this.
   * @param container - The parent element
   * @param options - Options
   * @returns The base embed.
   */
  private renderBaseEmbed(
    container: HTMLElement,
    options: BaseEmbedOptions,
  ): HTMLElement {
    const embedElement = container.createEl("a");
    embedElement.classList.add("gitlab-embed");

    embedElement.setAttribute("href", options.href);
    embedElement.setAttribute("target", "_blank");
    embedElement.setAttribute("rel", "noopener nofollow");

    embedElement.addClass("gitlab-embed");
    embedElement.addClasses(
      Array.isArray(options.clses) ? options.clses : [options.clses],
    );

    return embedElement;
  }

  /**
   * Renders an issue embed.
   * @param element - The parent element
   * @param url - The GitLab URL to the issue
   */
  private renderIssueEmbed(element: HTMLElement, issue: Issue): void {
    const embedElement = this.renderBaseEmbed(element, {
      href: issue.webUrl,
      clses: ["gitlab-issue"],
    });

    const baseUrls = this.settings.instances.map((i) => i.baseUrl);
    const { group, project } = new GitLabURL(issue.webUrl, baseUrls);
    const repoElement = embedElement.createEl("div", {
      text: `${group}/${project}`,
    });
    repoElement.classList.add("gitlab-repo");

    const headingElement = embedElement.createEl("div", {
      cls: "gitlab-heading",
    });

    // Identifier element
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

    const date = new Date(issue.createdAt);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0"); // months are 0-indexed
    const dd = String(date.getDate()).padStart(2, "0");

    // Date element
    detailsElement.createEl("div", {
      text: `${yyyy}-${mm}-${dd}`,
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
};

class GitLabURL {
  url: string;
  baseURL: string;
  group: string;
  project: string;
  resource: GitLabResource;
  id: string;

  constructor(url: string, validBaseURLs: string[]) {
    const baseURL = validBaseURLs.find((b) => url.startsWith(b));
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
