import { App, Editor, MarkdownView, requestUrl, Modal, Notice, Plugin, addIcon } from "obsidian";
import { DEFAULT_SETTINGS, GitLabPluginSettings, GitLabSettingTab } from "./settings";

enum GitLabResource {
  ISSUE = "issues",
  MERGE_REQUEST = "merge_request",
}

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

  private async renderIssueEmbed(element: HTMLElement, url: GitLabURL): Promise<void> {
    console.debug(`Fetching ${BASEURL}/api/v4/projects/${url.group}%2F${url.project}/issues/${url.id}`);
    const response = await requestUrl({ url: `${BASEURL}/api/v4/projects/${url.group}%2F${url.project}/issues/${url.id}`, method: "GET" });
    const issue = await response.json as GitLabIssue;
    console.debug(issue);

    const embedElement = element.createEl("a"); 
    embedElement.classList.add("gitlab-embed");
    embedElement.classList.add("gitlab-issue");

    const repoElement = embedElement.createEl("div", { text: `${url.group}/${url.project}` });
    repoElement.classList.add("gitlab-repo");

    const headingElement = embedElement.createEl("div");
    headingElement.classList.add("gitlab-heading");

    const identifierElement = headingElement.createEl("span", { text: '#' + url.id + " " });
    identifierElement.classList.add("gitlab-identifier");
    headingElement.appendText(issue.title);

    const authorElement = embedElement.createEl("div", { text: issue.author.username });
    authorElement.classList.add("gitlab-author");

    const date = new Date(issue.created_at);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const dd = String(date.getDate()).padStart(2, '0');

    const dateElement = embedElement.createEl("div", { text: `${yyyy}-${mm}-${dd}` });
    dateElement.classList.add("gitlab-date");
  }
}

type GitLabIssue = {
  title: string;
  author: {
    username: string;
  };
  created_at: string;
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
}
