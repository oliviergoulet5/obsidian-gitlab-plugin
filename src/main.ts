import { App, Editor, MarkdownView, Modal, Notice, Plugin} from "obsidian";
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

    switch (url.resource) {
      case GitLabResource.ISSUE:
        console.debug("Issue identified");
        break;
      case GitLabResource.MERGE_REQUEST:
        console.debug("Merge request identified");
        break;
      default:
        break;
    }
  }
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
    this.group = match[2] as string;
    this.project = match[3] as string;
    this.resource = match[4] as GitLabResource;
    this.id = match[5] as string;
  }
}
