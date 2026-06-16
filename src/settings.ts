import {
  App,
  ButtonComponent,
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
} from "obsidian";
import GitLabPlugin from "./main";

export enum AuthMethod {
  None = "none",
  Pat = "pat",
  OAuth = "oauth",
}

const AUTH_METHOD_LABELS: Record<AuthMethod, string> = {
  [AuthMethod.None]: "None (public resources only)",
  [AuthMethod.Pat]: "Personal access token",
  [AuthMethod.OAuth]: "OAuth",
};

export interface GitLabInstance {
  baseUrl: string;
  authMethod?: AuthMethod;
  clientId?: string;
  clientSecret?: string;
}

export interface GitLabPluginSettings {
  instances: GitLabInstance[];
}

export const DEFAULT_SETTINGS: GitLabPluginSettings = {
  instances: [{ baseUrl: "https://gitlab.com", authMethod: AuthMethod.None }],
};

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

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
    this.plugin.reloadClients();

    new Setting(containerEl)
      .setName("GitLab instances")
      .setDesc(
        "Enter the base URLs of the GitLab instances you use, one per line.",
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
              .map((url) => normalizeBaseUrl(url))
              .filter((url) => url.length > 0);

            this.plugin.settings.instances = urls.map((url) => {
              const existing = this.plugin.settings.instances.find(
                (i) => normalizeBaseUrl(i.baseUrl) === url,
              );
              return {
                baseUrl: url,
                authMethod: existing?.authMethod ?? AuthMethod.None,
                clientId: existing?.clientId,
                clientSecret: existing?.clientSecret,
              };
            });
            await this.plugin.saveSettings();
            this.plugin.reloadClients();
            this.display();
          });
      })
      .addButton((component) =>
        component.setButtonText("Refresh").onClick(() => {
          this.display();
        }),
      );

    this.plugin.settings.instances.forEach((instance) => {
      this.renderInstanceSettings(containerEl, instance);
    });
  }

  private renderInstanceSettings(
    containerEl: HTMLElement,
    instance: GitLabInstance,
  ): void {
    const client = this.plugin.clients[instance.baseUrl];
    const authMethod = instance.authMethod ?? AuthMethod.None;

    new Setting(containerEl).setName(instance.baseUrl).setHeading();

    new Setting(containerEl)
      .setName("Authentication")
      .setDesc("Choose how this instance authenticates with GitLab.")
      .addDropdown((dropdown) => {
        for (const method of Object.values(AuthMethod)) {
          dropdown.addOption(method, AUTH_METHOD_LABELS[method]);
        }
        dropdown.setValue(authMethod);
        dropdown.onChange((value) => {
          void this.setAuthMethod(instance, value as AuthMethod);
        });
      });

    if (authMethod === AuthMethod.Pat) {
      this.renderPatSettings(containerEl, instance, client);
    } else if (authMethod === AuthMethod.OAuth) {
      void this.renderOAuthSettings(containerEl, instance, client);
    } else {
      new Setting(containerEl).setDesc(
        "Public issues and merge requests work without authentication.",
      );
    }

    if (authMethod !== AuthMethod.None) {
      new Setting(containerEl)
        .setName("Test connection")
        .setDesc("Verify this instance is reachable with your credentials.")
        .addButton((button) => {
          button.setButtonText("Test").onClick(() => {
            void this.testConnection(button, client);
          });
        });
    }
  }

  private renderPatSettings(
    containerEl: HTMLElement,
    instance: GitLabInstance,
    client: GitLabPlugin["clients"][string] | undefined,
  ): void {
    new Setting(containerEl)
      .setName("Personal access token")
      .setDesc(
        "GitLab → Preferences → Access Tokens. Scope: read_api (or api).",
      )
      .addText((component) => {
        component.inputEl.type = "password";
        component.setPlaceholder(
          client?.hasPat() ? "Token configured" : "glpat-...",
        );
        component.onChange(async (value) => {
          if (!client) return;
          const token = value.trim();
          if (token.length > 0) {
            client.setPat(token);
          }
        });
      })
      .addButton((btn) =>
        btn.setButtonText("Clear").onClick(() => {
          if (!client) return;
          client.clearPat();
          new Notice("Personal access token cleared");
          this.display();
        }),
      );
  }

  private async renderOAuthSettings(
    containerEl: HTMLElement,
    instance: GitLabInstance,
    client: GitLabPlugin["clients"][string] | undefined,
  ): Promise<void> {
    let previousClientId = instance.clientId;
    let previousClientSecret = instance.clientSecret;

    new Setting(containerEl)
      .setName("Client ID")
      .setDesc("OAuth client_id from your GitLab application settings.")
      .addText((component) => {
        component
          .setValue(instance.clientId || "")
          .setPlaceholder("Application ID")
          .onChange(async (value) => {
            const newClientId = value.trim() || undefined;
            const credentialsChanged =
              newClientId !== previousClientId ||
              instance.clientSecret !== previousClientSecret;

            instance.clientId = newClientId;
            previousClientId = newClientId;
            await this.plugin.saveSettings();
            this.plugin.reloadClients();

            if (credentialsChanged && client) {
              await client.logout();
            }
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("Client secret")
      .setDesc("Required for confidential OAuth applications.")
      .addText((component) => {
        component.inputEl.type = "password";
        component
          .setValue(instance.clientSecret || "")
          .setPlaceholder("Leave empty for public OAuth apps")
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
      const isAuth = await client.isAuthenticated();
      new Setting(containerEl)
        .setName("Authorization")
        .setDesc("Sign in to GitLab with your OAuth application.")
        .addButton((component) => {
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
  }

  private async setAuthMethod(
    instance: GitLabInstance,
    method: AuthMethod,
  ): Promise<void> {
    if (instance.authMethod === method) return;

    const client = this.plugin.clients[instance.baseUrl];

    if (method !== AuthMethod.Pat && client) {
      client.clearPat();
    }

    if (method !== AuthMethod.OAuth) {
      if (client) {
        await client.logout();
      }
      instance.clientId = undefined;
      instance.clientSecret = undefined;
    }

    instance.authMethod = method;
    await this.plugin.saveSettings();
    this.plugin.reloadClients();
    this.display();
  }

  private async testConnection(
    button: ButtonComponent,
    client: GitLabPlugin["clients"][string] | undefined,
  ): Promise<void> {
    if (!client) {
      button.setButtonText("No client");
      window.setTimeout(() => {
        button.setButtonText("Test");
      }, 3000);
      return;
    }

    button.setButtonText("Testing...");
    try {
      const username = await client.testConnection();
      button.setButtonText(`Connected as ${username}`);
    } catch {
      button.setButtonText("Failed - check settings");
    }
    window.setTimeout(() => {
      button.setButtonText("Test");
    }, 3000);
  }
}
