import { App, PluginSettingTab, Setting } from "obsidian";
import GitLabPlugin from "./main";

export interface GitLabInstance {
  baseUrl: string;
  clientId?: string;
}

export interface GitLabPluginSettings {
  instances: GitLabInstance[];
}

export const DEFAULT_SETTINGS: GitLabPluginSettings = {
  instances: [{ baseUrl: "https://gitlab.com" }],
};

export class GitLabSettingTab extends PluginSettingTab {
  plugin: GitLabPlugin;

  constructor(app: App, plugin: GitLabPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("GitLab instances")
      .setDesc(
        "Enter the base urls to the GitLab instances you use. Separate each base urls in a new line.",
      )
      .addTextArea((component) => {
        component
          .setValue(
            this.plugin.settings.instances.map((i) => i.baseUrl).join("\n"),
          )
          .setPlaceholder("https://gitlab.com")
          .onChange(async (value) => {
            const urls = value
              .split("\n")
              .map((url) => url.trim())
              .filter((url) => url.length > 0);

            // Preserve existing clientIds for URLs that still exist
            this.plugin.settings.instances = urls.map((url) => {
              const existing = this.plugin.settings.instances.find(
                (i) => i.baseUrl === url,
              );
              return {
                baseUrl: url,
                clientId: existing?.clientId,
              };
            });
            await this.plugin.saveSettings();
          });
      })
      .addButton((component) =>
        component.setButtonText("Refresh").onClick(() => {
          this.display();
        }),
      );

    this.plugin.settings.instances.forEach((instance) => {
      const client = this.plugin.clients[instance.baseUrl];

      new Setting(containerEl)
        .setName(`Client ID: ${instance.baseUrl}`)
        .setDesc(
          "Enter the OAuth client_id from your GitLab application settings",
        )
        .addText((component) => {
          component
            .setValue(instance.clientId || "")
            .setPlaceholder("Optional - leave empty for public access")
            .onChange(async (value) => {
              instance.clientId = value.trim() || undefined;
              await this.plugin.saveSettings();
              this.plugin.reloadClients();
            });
        });

      if (instance.clientId && client) {
        new Setting(containerEl)
          .setName(`Authorize: ${instance.baseUrl}`)
          .setDesc(
            "Click to authorize the plugin to access your GitLab account.",
          )
          .addButton((component) =>
            component.setButtonText("Authorize").onClick(async () => {
              await client.authorize();
            }),
          );
      }
    });
  }
}
