# Embed GitLab Plugin for Obsidian

An Obsidian plugin that embeds GitLab **issues** and **merge requests** directly
into your notes for quick reference and better context.

<img width="717" height="115" alt="Screenshot from 2026-02-04 23-50-52" src="https://github.com/user-attachments/assets/a20db904-222b-4fc8-af49-13fa8cc57348" />

## Getting Started

1. Install the **Obsidian GitLab Embeds** plugin.
2. Add a GitLab link or discussion block to a note (see below).
3. Content renders in **Reading view** and **Live Preview**. **Source mode** shows the raw markdown.

**gitlab.com** is configured by default. For a self-hosted instance, add its
base URL under **Settings → GitLab Embeds** (for example
`https://gitlab.housecalldev.com`).

### Supported URL format

Link embeds accept bare URLs or markdown links that match:

```
https://<instance>/<group>/<project>/-/issues/<id>
https://<instance>/<group>/<project>/-/merge_requests/<id>
```

Example:

```
https://gitlab.com/group/project/-/merge_requests/123
```

### Issue and merge request embeds

Paste a supported GitLab issue or merge request URL into a note. The plugin
replaces the link with a preview card.

**Issue cards** show the repo, title, author, date, and labels.

**Merge request cards** also show:

- Source → target branch, author, date, and labels
- Merge state (Open, Merged, or Closed) with the relevant date
- Pipeline status (Passed, Failed, Running, and so on) when a CI pipeline exists

### Merge request discussions

Paste a **merge request** URL inside a `gitlab-mr-discuss` code block to render
review threads and comments:

````markdown
```gitlab-mr-discuss
https://gitlab.example.com/group/project/-/merge_requests/123
```
````

The block shows:

- A compact MR header with title and merge state
- A summary line (for example `12 threads · 3 unresolved`)
- All non-system discussion threads, including inline code review comments with
  `file:line` locations
- Resolved threads marked with a **Resolved** badge

Notes:

- **Merge request URLs only** — issue URLs are not supported in this block.
- Comment bodies are shown as plain text (GitLab markdown is not fully rendered).
- System notes (for example “changed the description”) are excluded.
- Renders in **Reading view** and **Live Preview**, like link embeds.

Private merge requests require PAT or OAuth authentication (see below).

## Authentication

Public GitLab resources work without authentication. For private projects,
pick **one** authentication method per instance in **Settings → GitLab Embeds**:

### None (default)

Use for public issues and merge requests. No credentials required.

### Personal access token

1. Set **Authentication** to **Personal access token**.
2. Go to your GitLab instance → **Preferences → Access Tokens**.
3. Create a token with the **read_api** scope (or **api**).
4. Paste the token and click **Test** to verify.

Tokens are stored in Obsidian's secret storage, not in plain settings.

### OAuth

1. Set **Authentication** to **OAuth**.
2. Create a GitLab OAuth application with redirect URI `obsidian://gitlab-embeds`.
3. Enter the Client ID and Client Secret (if required), then click **Authorize**.

Only one method is active per instance. Switching methods clears the other.

## Disclaimer

This plugin makes network requests to configured GitLab instances (e.g.
gitlab.com or self-hosted servers) in order to fetch and display embeds and
discussion threads.

## Contribute

Contributions are welcome!

- Feel free to open issues for bugs, feature requests, or improvements.
- Submit pull requests if you want to add features or fix issues.
- Make sure to follow the existing code style and test your changes in Obsidian.

### Local Setup

To develop and test the plugin locally:

1. **Clone the repository**
   ```bash
   git clone https://github.com/oliviergoulet5/obsidian-gitlab-plugin.git
   cd obsidian-gitlab-plugin
   ```
2. **Install dependencies**
   ```
   npm ci
   ```
3. **Make changes** — write your feature or bug fix.
4. **Build the plugin**
   ```
   npm run build
   ```
5. **Link to your Obsidian vault**

   Preferred — symlink via script:

   ```bash
   OBSIDIAN_VAULT=/path/to/your-vault npm run link:vault
   ```

   Or copy `main.js`, `manifest.json`, and `styles.css` to:

   ```
   <your-vault>/.obsidian/plugins/gitlab-embeds/
   ```

6. **Enable the plugin** — open **Obsidian → Settings → Community plugins**
   and enable **GitLab Embeds**.
