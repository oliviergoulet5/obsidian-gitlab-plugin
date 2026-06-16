import { Plugin, requestUrl } from "obsidian";
import AuthService from "./auth-service";
import { AuthMethod } from "./settings";

type GitLabAPIClientOptions = {
  baseURL: string;
  plugin: Plugin;
  authMethod: AuthMethod;
  clientId?: string;
  clientSecret?: string;
};

export class GitLabApiError extends Error {
  status: number;
  path: string;

  constructor(status: number, path: string) {
    super(`GitLab API error ${status}: ${path}`);
    this.status = status;
    this.path = path;
  }
}

export class GitLabAPIClient {
  private instanceBaseURL: string;
  private baseURL: string;
  private plugin: Plugin;
  private authMethod: AuthMethod;
  private authService: AuthService | null = null;

  constructor(options: GitLabAPIClientOptions) {
    this.instanceBaseURL = options.baseURL;
    this.baseURL = options.baseURL + "/api";
    this.plugin = options.plugin;
    this.authMethod = options.authMethod;

    if (options.authMethod === AuthMethod.OAuth && options.clientId) {
      this.authService = new AuthService(
        options.plugin,
        options.baseURL,
        options.clientId,
        options.clientSecret,
      );
    }
  }

  private getPatStorageKey(): string {
    const sanitizedUrl = this.instanceBaseURL
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    return `pat-${sanitizedUrl}`;
  }

  getPat(): string | null {
    const token = this.plugin.app.secretStorage.getSecret(
      this.getPatStorageKey(),
    );
    return token && token.length > 0 ? token : null;
  }

  setPat(token: string): void {
    this.plugin.app.secretStorage.setSecret(this.getPatStorageKey(), token);
  }

  clearPat(): void {
    this.plugin.app.secretStorage.setSecret(this.getPatStorageKey(), "");
  }

  hasPat(): boolean {
    return this.getPat() !== null;
  }

  async authorize() {
    if (!this.authService) {
      throw new Error("clientId not configured");
    }
    const url = await this.authService.getAuthorizeUrl();
    window.location.href = url;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    if (!this.authService) {
      throw new Error("clientId not configured");
    }
    await this.authService.handleCallback(code, state);
  }

  async getValidToken(): Promise<string | null> {
    if (!this.authService) return null;
    return await this.authService.getValidToken();
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.authService) return false;
    return await this.authService.isAuthenticated();
  }

  async logout(): Promise<void> {
    if (!this.authService) {
      throw new Error("clientId not configured");
    }
    await this.authService.logout();
  }

  private async resolveAuthHeaders(): Promise<Record<string, string>> {
    if (this.authMethod === AuthMethod.Pat) {
      const pat = this.getPat();
      if (pat) {
        return { "PRIVATE-TOKEN": pat };
      }
      return {};
    }

    if (this.authMethod === AuthMethod.OAuth) {
      const oauth = await this.getValidToken();
      if (oauth) {
        return { Authorization: `Bearer ${oauth}` };
      }
    }

    return {};
  }

  private async request<T>(path: string, method = "GET"): Promise<T> {
    const response = await requestUrl({
      url: `${this.baseURL}/v4/${path}`,
      method,
      headers: {
        ...(await this.resolveAuthHeaders()),
        "Content-Type": "application/json",
      },
      throw: false,
    });

    if (response.status >= 400) {
      throw new GitLabApiError(response.status, path);
    }

    return response.json as T;
  }

  private async requestPaginated<T>(
    path: string,
    options: { perPage?: number; maxPages?: number } = {},
  ): Promise<T[]> {
    const perPage = options.perPage ?? 100;
    const maxPages = options.maxPages ?? 10;
    const results: T[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const separator = path.includes("?") ? "&" : "?";
      const pagePath = `${path}${separator}per_page=${perPage}&page=${page}`;
      const pageResults = await this.request<T[]>(pagePath);
      if (!Array.isArray(pageResults) || pageResults.length === 0) {
        break;
      }
      results.push(...pageResults);
      if (pageResults.length < perPage) {
        break;
      }
    }

    return results;
  }

  async testConnection(): Promise<string> {
    const user = await this.request<{ username: string }>("user");
    return user.username;
  }

  /**
   * Get a single project issue.
   *
   * @param id - The ID of the project.
   * @param issueIid - The internal ID of a project issue.
   * @returns A single project issue.
   * @throws
   */
  async getProjectIssue(id: string, issueIid: string) {
    const data = await this.request<_APIIssue>(
      `projects/${id}/issues/${issueIid}`,
    );
    return issueMapper(data);
  }

  async getProjectMergeRequest(id: string, mergeRequestIid: string) {
    const data = await this.request<_APIMergeRequest>(
      `projects/${id}/merge_requests/${mergeRequestIid}`,
    );
    return mergeRequestMapper(data);
  }

  async getProjectMergeRequestDiscussions(id: string, mergeRequestIid: string) {
    const data = await this.requestPaginated<_APIMergeRequestDiscussion>(
      `projects/${id}/merge_requests/${mergeRequestIid}/discussions`,
    );
    return data.map(discussionMapper);
  }
}

type _APIIssue = {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  labels: string[];
  author: {
    id: number;
    username: string;
    public_email: string;
    name: string;
    state: string;
    locked: boolean;
    avatar_url: string;
    web_url: string;
  };
  type: string;
  user_notes_count: number;
  upvotes: number;
  downvotes: number;
  confidential: boolean;
  web_url: string;
};

export type Issue = {
  id: number;
  iid: number;
  projectId: number;
  title: string;
  description: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | undefined;
  closedBy: string | undefined;
  labels: string[];
  author: {
    id: number;
    publicEmail: string;
    username: string;
    name: string;
    state: string;
    locked: boolean;
    avatarUrl: string;
    webUrl: string;
  };
  type: string;
  userNotesCount: number;
  upvotes: number;
  downvotes: number;
  confidential: boolean;
  webUrl: string;
};

function issueMapper(data: _APIIssue): Issue {
  return {
    id: data.id,
    iid: data.iid,
    projectId: data.project_id,
    title: data.title,
    description: data.description,
    state: data.state,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    closedAt: data.closed_at || undefined,
    closedBy: data.closed_by || undefined,
    labels: data.labels,
    author: {
      id: data.author.id,
      publicEmail: data.author.public_email,
      username: data.author.username,
      name: data.author.name,
      state: data.author.state,
      locked: data.author.locked,
      avatarUrl: data.author.avatar_url,
      webUrl: data.author.web_url,
    },
    type: data.type,
    userNotesCount: data.user_notes_count,
    upvotes: data.upvotes,
    downvotes: data.downvotes,
    confidential: data.confidential,
    webUrl: data.web_url,
  };
}

type _APIMergeRequest = {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  source_branch: string;
  target_branch: string;
  labels: string[];
  author: {
    id: number;
    username: string;
    public_email: string;
    name: string;
    state: string;
    locked: boolean;
    avatar_url: string;
    web_url: string;
  };
  web_url: string;
  head_pipeline?: {
    iid?: number;
    status: string;
    web_url?: string;
    duration?: number | null;
    finished_at?: string | null;
  } | null;
};

export type MergeRequestHeadPipeline = {
  status: string;
  iid?: number;
  webUrl?: string;
  duration?: number;
  finishedAt?: string;
};

export type MergeRequest = {
  id: number;
  iid: number;
  projectId: number;
  title: string;
  description: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | undefined;
  closedAt: string | undefined;
  sourceBranch: string;
  targetBranch: string;
  labels: string[];
  author: {
    id: number;
    publicEmail: string;
    username: string;
    name: string;
    state: string;
    locked: boolean;
    avatarUrl: string;
    webUrl: string;
  };
  webUrl: string;
  headPipeline?: MergeRequestHeadPipeline;
};

function mergeRequestMapper(data: _APIMergeRequest): MergeRequest {
  return {
    id: data.id,
    iid: data.iid,
    projectId: data.project_id,
    title: data.title,
    description: data.description,
    state: data.state,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    mergedAt: data.merged_at || undefined,
    closedAt: data.closed_at || undefined,
    sourceBranch: data.source_branch,
    targetBranch: data.target_branch,
    labels: data.labels,
    author: {
      id: data.author.id,
      publicEmail: data.author.public_email,
      username: data.author.username,
      name: data.author.name,
      state: data.author.state,
      locked: data.author.locked,
      avatarUrl: data.author.avatar_url,
      webUrl: data.author.web_url,
    },
    webUrl: data.web_url,
    headPipeline: data.head_pipeline
      ? {
          status: data.head_pipeline.status,
          iid: data.head_pipeline.iid,
          webUrl: data.head_pipeline.web_url,
          duration: data.head_pipeline.duration ?? undefined,
          finishedAt: data.head_pipeline.finished_at ?? undefined,
        }
      : undefined,
  };
}

type _APIDiscussionNotePosition = {
  new_path?: string;
  old_path?: string;
  new_line?: number | null;
  old_line?: number | null;
};

type _APIDiscussionNote = {
  id: number;
  body: string;
  system: boolean;
  created_at: string;
  resolved?: boolean;
  resolvable?: boolean;
  position?: _APIDiscussionNotePosition | null;
  author: {
    username: string;
    avatar_url: string;
    name: string;
  };
};

type _APIMergeRequestDiscussion = {
  id: string;
  individual_note: boolean;
  notes: _APIDiscussionNote[];
};

export type MergeRequestDiscussionNotePosition = {
  newPath?: string;
  oldPath?: string;
  newLine?: number;
  oldLine?: number;
};

export type MergeRequestDiscussionNote = {
  id: number;
  body: string;
  system: boolean;
  createdAt: string;
  resolved: boolean;
  resolvable: boolean;
  position?: MergeRequestDiscussionNotePosition;
  author: {
    username: string;
    avatarUrl: string;
    name: string;
  };
};

export type MergeRequestDiscussion = {
  id: string;
  individualNote: boolean;
  notes: MergeRequestDiscussionNote[];
};

function discussionNoteMapper(
  data: _APIDiscussionNote,
): MergeRequestDiscussionNote {
  return {
    id: data.id,
    body: data.body,
    system: data.system,
    createdAt: data.created_at,
    resolved: data.resolved ?? false,
    resolvable: data.resolvable ?? false,
    position: data.position
      ? {
          newPath: data.position.new_path,
          oldPath: data.position.old_path,
          newLine: data.position.new_line ?? undefined,
          oldLine: data.position.old_line ?? undefined,
        }
      : undefined,
    author: {
      username: data.author.username,
      avatarUrl: data.author.avatar_url,
      name: data.author.name,
    },
  };
}

function discussionMapper(
  data: _APIMergeRequestDiscussion,
): MergeRequestDiscussion {
  return {
    id: data.id,
    individualNote: data.individual_note,
    notes: data.notes.map(discussionNoteMapper),
  };
}
