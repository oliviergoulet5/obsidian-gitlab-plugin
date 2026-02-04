import { App, PluginSettingTab, Setting } from "obsidian";
import GitLabPlugin from "./main";

export interface GitLabPluginSettings {
  baseUrl: string;
  baseUrls: string[];
}

export const DEFAULT_SETTINGS: GitLabPluginSettings = {
  baseUrl: "https://gitlab.com",
  baseUrls: ["https://gitlab.com"],
}

export class GitLabSettingTab extends PluginSettingTab {
  plugin: GitLabPlugin;

  constructor(app: App, plugin: GitLabPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("GitLab instances")
      .setDesc("Enter the base urls to the GitLab instances you use. Separate each base urls in a new line.")
      .addTextArea(component => {
        component.setPlaceholder(this.plugin.settings.baseUrls.join("\n"))
      });
	}
}
