import { App, Plugin, SecretStorage, requestUrl } from "obsidian";

type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

type InstanceAuthData = {
  codeVerifier: string;
  state: string;
  clientId: string;
};

class AuthService {
  private app: App;
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string | undefined;
  private secretStorage: SecretStorage;

  constructor(
    plugin: Plugin,
    baseUrl: string,
    clientId: string,
    clientSecret?: string,
  ) {
    this.app = plugin.app;
    this.baseUrl = baseUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.secretStorage = this.app.secretStorage;
  }

  private getStorageKey(prefix: string): string {
    const sanitizedUrl = this.baseUrl.toLowerCase().replace(/[^a-z0-9]/g, "-");
    return `${prefix.toLowerCase()}-${sanitizedUrl}`;
  }

  private generateRandom(): string {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    return this.base64UrlEncode(randomBytes);
  }

  private base64UrlEncode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(digest);
    return this.base64UrlEncode(hashArray);
  }

  async init(): Promise<void> {
    const key = this.getStorageKey("auth");
    const existing = this.secretStorage.getSecret(key);

    if (!existing) {
      const data: InstanceAuthData = {
        codeVerifier: this.generateRandom(),
        state: this.generateRandom(),
        clientId: this.clientId,
      };

      this.secretStorage.setSecret(key, JSON.stringify(data));
    }
  }

  async getAuthorizeUrl(): Promise<string> {
    await this.init();

    const key = this.getStorageKey("auth");
    const dataStr = this.secretStorage.getSecret(key);
    const data: InstanceAuthData = JSON.parse(dataStr!) as InstanceAuthData;

    const codeChallenge = await this.generateCodeChallenge(data.codeVerifier);

    const url = new URL(`${this.baseUrl}/oauth/authorize`);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", "obsidian://gitlab-embeds");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", data.state);
    url.searchParams.set("scope", "read_api");
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", codeChallenge);

    return url.href;
  }

  async handleCallback(code: string, returnedState: string): Promise<void> {
    const key = this.getStorageKey("auth");
    const dataStr = this.secretStorage.getSecret(key);
    const data: InstanceAuthData = JSON.parse(dataStr!) as InstanceAuthData;

    if (returnedState !== data.state) {
      throw new Error("State mismatch - possible CSRF attack");
    }

    const codeVerifier = data.codeVerifier;

    const url = new URL(`${this.baseUrl}/oauth/token`);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("code", code);
    url.searchParams.set("grant_type", "authorization_code");
    url.searchParams.set("redirect_uri", "obsidian://gitlab-embeds");
    url.searchParams.set("code_verifier", codeVerifier);
    if (this.clientSecret) {
      url.searchParams.set("client_secret", this.clientSecret);
    }

    const response = await requestUrl({
      url: url.toString(),
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const tokens = response.json as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    const storedTokens: StoredTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    const tokenKey = this.getStorageKey("tokens");
    this.secretStorage.setSecret(tokenKey, JSON.stringify(storedTokens));

    const newData: InstanceAuthData = {
      ...data,
      codeVerifier: this.generateRandom(),
      state: this.generateRandom(),
    };

    this.secretStorage.setSecret(key, JSON.stringify(newData));
  }

  async getValidToken(): Promise<string | null> {
    const tokenKey = this.getStorageKey("tokens");
    const tokensStr = this.secretStorage.getSecret(tokenKey);

    if (!tokensStr) return null;

    const tokens = JSON.parse(tokensStr) as StoredTokens;

    if (tokens.expiresAt && Date.now() > tokens.expiresAt - 60000) {
      if (tokens.refreshToken) {
        return await this.refreshToken(tokens.refreshToken);
      }
      return null;
    }

    return tokens.accessToken;
  }

  private async refreshToken(refreshToken: string): Promise<string> {
    const url = new URL(`${this.baseUrl}/oauth/token`);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("refresh_token", refreshToken);
    url.searchParams.set("grant_type", "refresh_token");
    url.searchParams.set("redirect_uri", "obsidian://gitlab-embeds");
    if (this.clientSecret) {
      url.searchParams.set("client_secret", this.clientSecret);
    }

    const response = await requestUrl({
      url: url.toString(),
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const tokens = response.json as OAuthTokenResponse;
    const storedTokens: StoredTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    const tokenKey = this.getStorageKey("tokens");
    this.secretStorage.setSecret(tokenKey, JSON.stringify(storedTokens));

    return storedTokens.accessToken;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getValidToken();
    return token !== null;
  }

  async logout(): Promise<void> {
    const tokenKey = this.getStorageKey("tokens");

    const tokensStr = this.secretStorage.getSecret(tokenKey);
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr) as StoredTokens;
      if (tokens.accessToken) {
        await this.revokeToken(tokens.accessToken);
      }
      if (tokens.refreshToken) {
        await this.revokeToken(tokens.refreshToken);
      }
    }

    this.secretStorage.setSecret(tokenKey, "");
  }

  private async revokeToken(token: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/oauth/token/revoke`);
    url.searchParams.set("token", token);
    if (this.clientSecret) {
      url.searchParams.set("client_id", this.clientId);
      url.searchParams.set("client_secret", this.clientSecret);
    }

    try {
      await requestUrl({
        url: url.toString(),
        method: "POST",
      });
    } catch {
      // Ignore revocation errors - we still want to clear local state
    }
  }
}

export default AuthService;

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};
