import { requestUrl } from "obsidian";

type GitLabAPIClientOptions = {
  baseURL?: string;
}

export class GitLabAPIClient {
  private baseURL: string;

  constructor(options: GitLabAPIClientOptions = {}) {
    this.baseURL = options.baseURL ?? "https://gitlab.com/api";
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
    console.debug(`${this.baseURL}/v4/projects/${id}/issues/${issueIid}`);
    const response = await requestUrl({ 
      url: `${this.baseURL}/v4/projects/${id}/issues/${issueIid}`, 
      method: "GET" 
    });

    const data = await response.json as _APIIssue;
    
    return issueMapper(data);
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
  }
  type: string;
  user_notes_count: number;
  upvotes: number;
  downvotes: number;
  confidential: boolean;
}

type Issue = {
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
  }
  type: string;
  userNotesCount: number;
  upvotes: number;
  downvotes: number;
  confidential: boolean;
}

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
  }
}
