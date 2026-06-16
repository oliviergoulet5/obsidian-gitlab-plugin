import { Notice, Plugin } from "obsidian";
import {
  AuthMethod,
  DEFAULT_SETTINGS,
  GitLabPluginSettings,
  GitLabSettingTab,
  normalizeBaseUrl,
} from "./settings";
import { GitLabAPIClient } from "./api-client";
import { processMrDiscussCodeBlock } from "./discuss-block-processor";
import { clearDiscussCache } from "./discuss-service";
import { clearEmbedCache, processAnchorElement } from "./embed-service";
import { createGitLabLivePreviewExtension } from "./live-preview-extension";

type GitLabAPIClientRecord = Record<string, GitLabAPIClient>;

export default class GitLabPlugin extends Plugin {
  settings: GitLabPluginSettings;
  clients: GitLabAPIClientRecord = {};

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new GitLabSettingTab(this.app, this));
    this.reloadClients();

    // Register OAuth callback handler
    this.registerObsidianProtocolHandler("gitlab-embeds", async (data) => {
      const code = data.code as string;
      const state = data.state as string;

      // Find the instance that initiated this OAuth flow
      const instance = this.settings.instances.find(
        (i) => i.authMethod === AuthMethod.OAuth && i.clientId,
      );
      const baseUrl = instance?.baseUrl;
      const client = baseUrl ? this.clients[baseUrl] : undefined;
      if (client && code && state) {
        await client.handleCallback(code, state);
        new Notice("Successfully connected to GitLab!", 5000);
      }
    });

    this.registerMarkdownPostProcessor(async (element) => {
      const anchorElements = Array.from(element.querySelectorAll("a"));
      await Promise.all(
        anchorElements.map((anchorElement) =>
          processAnchorElement(this, anchorElement),
        ),
      );
    });

    this.registerMarkdownCodeBlockProcessor(
      "gitlab-mr-discuss",
      async (source, el) => {
        await processMrDiscussCodeBlock(this, source, el);
      },
    );

    this.registerEditorExtension(createGitLabLivePreviewExtension(this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<GitLabPluginSettings>,
    );
    this.settings.instances = this.settings.instances.map((instance) => {
      const baseUrl = normalizeBaseUrl(instance.baseUrl);
      let authMethod = instance.authMethod;

      if (!authMethod) {
        const patKey = `pat-${baseUrl.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        const pat = this.app.secretStorage.getSecret(patKey);
        if (pat && pat.length > 0) {
          authMethod = AuthMethod.Pat;
        } else if (instance.clientId) {
          authMethod = AuthMethod.OAuth;
        } else {
          authMethod = AuthMethod.None;
        }
      }

      return {
        ...instance,
        baseUrl,
        authMethod,
      };
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  reloadClients() {
    clearEmbedCache();
    clearDiscussCache();
    this.clients = {};
    this.settings.instances.forEach(
      (instance) =>
        (this.clients[instance.baseUrl] = new GitLabAPIClient({
          baseURL: instance.baseUrl,
          plugin: this,
          authMethod: instance.authMethod ?? AuthMethod.None,
          clientId: instance.clientId,
          clientSecret: instance.clientSecret,
        })),
    );
  }
}
