import { App, PluginSettingTab, Setting } from "obsidian";
import GitLabPlugin from "./main";

export interface GitLabPluginSettings {
  baseUrl: string;
}

export const DEFAULT_SETTINGS: GitLabPluginSettings = {
  baseUrl: "https://gitlab.com",
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
	}
}
