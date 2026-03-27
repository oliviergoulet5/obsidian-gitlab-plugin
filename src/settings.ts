import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import GitLabPlugin from "./main";

export interface GitLabInstance {
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
}

export interface GitLabPluginSettings {
  instances: GitLabInstance[];
}

export const DEFAULT_SETTINGS: GitLabPluginSettings = {
  instances: [{ baseUrl: "https://gitlab.com" }],
};

class LogoutConfirmModal extends Modal {
  private onConfirm: () => void;

  constructor(app: App, onConfirm: () => void) {
    super(app);
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText("Are you sure you want to log out?");

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close()),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Logout")
          .setCta()
          .onClick(() => {
            this.close();
            this.onConfirm();
          }),
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

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

            // Preserve existing clientIds and clientSecrets for URLs that still exist
            this.plugin.settings.instances = urls.map((url) => {
              const existing = this.plugin.settings.instances.find(
                (i) => i.baseUrl === url,
              );
              return {
                baseUrl: url,
                clientId: existing?.clientId,
                clientSecret: existing?.clientSecret,
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

      let previousClientId = instance.clientId;
      let previousClientSecret = instance.clientSecret;

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
              const newClientId = value.trim() || undefined;
              const credentialsChanged =
                newClientId !== previousClientId ||
                instance.clientSecret !== previousClientSecret;

              instance.clientId = newClientId;
              previousClientId = newClientId;
              await this.plugin.saveSettings();
              this.plugin.reloadClients();

              if (credentialsChanged && previousClientId && client) {
                await client.logout();
              }
            });
        });

      new Setting(containerEl)
        .setName(`Advanced`)
        .setDesc("Show additional OAuth settings")
        .addToggle((component) => {
          component.setValue(false);
          component.onChange((showAdvanced) => {
            const advancedContainer = containerEl.querySelector(
              `.advanced-settings-${instance.baseUrl.replace(/[^a-zA-Z0-9]/g, "-")}`,
            );
            if (advancedContainer instanceof HTMLElement) {
              advancedContainer.style.display = showAdvanced ? "block" : "none";
            }
          });
        });

      const advancedDiv = containerEl.createEl("div", {
        cls: `advanced-settings-${instance.baseUrl.replace(/[^a-zA-Z0-9]/g, "-")}`,
        attr: { style: "display: none; padding-left: 20px;" },
      });

      new Setting(advancedDiv)
        .setName("Client secret")
        .setDesc(
          "Enter the OAuth client_secret (required for confidential applications)",
        )
        .addText((component) => {
          component.inputEl.type = "password";
          component
            .setValue(instance.clientSecret || "")
            .setPlaceholder("Leave empty for public access")
            .onChange(async (value) => {
              const newClientSecret = value.trim() || undefined;
              const credentialsChanged =
                instance.clientId !== previousClientId ||
                newClientSecret !== previousClientSecret;

              instance.clientSecret = newClientSecret;
              previousClientSecret = newClientSecret;
              await this.plugin.saveSettings();
              this.plugin.reloadClients();

              if (credentialsChanged && instance.clientId && client) {
                await client.logout();
              }
            });
        });

      if (instance.clientId && client) {
        new Setting(containerEl)
          .setName(`Authorize: ${instance.baseUrl}`)
          .setDesc("Authorize the plugin to access your GitLab account.")
          .addButton(async (component) => {
            const isAuth = await client.isAuthenticated();
            if (isAuth) {
              component.setButtonText("Logout").onClick(() => {
                new LogoutConfirmModal(this.app, () => {
                  void (async () => {
                    await client.logout();
                    new Notice("Logged out successfully");
                    this.display();
                  })();
                }).open();
              });
            } else {
              component.setButtonText("Authorize").onClick(() => {
                void client.authorize();
              });
            }
          });
      }
    });
  }
}
