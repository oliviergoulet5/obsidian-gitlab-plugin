import { App, Editor, MarkdownView, Modal, Notice, Plugin} from 'obsidian';
import { DEFAULT_SETTINGS, GitLabPluginSettings, GitLabSettingTab } from "./settings";

// Remember to rename these classes and interfaces!

export default class GitLabPlugin extends Plugin {
  settings: GitLabPluginSettings;

  async onload() {
    await this.loadSettings();
  }

  onunload() {
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<GitLabPluginSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
