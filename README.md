# Embed GitLab Plugin for Obsidian 

An Obsidian plugin that embeds GitLab resources (issues, merge requests,
projects, and more) directly into your notes for quick reference and better
context.

## Getting Started

1. Install the **Obsidian GitLab Embeds** plugin.
2. Paste a supported GitLab URL (issue, merge request, repository, etc.) into a note.
3. Switch to preview mode to see the embed rendered.

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
3. **Make changes**\
    Write your feature or bug fix.
4. **Build the plugin**
    ```
    npm run build
    ```
5. **Link to your Obsidian vault**\
    Copy the `main.js`, `manifest.json`, and `styles.css` (if present) to your
    vault’s plugin folder:
    ```
    <your-vault>/.obsidian/plugins/obsidian-gitlab-embeds/
    ```

    Alternatively, you can make this automatic by either cloning into the
    plugins directory, or by creating a symlink. This should be more convenient.
6. **Toggle to enable the plugin**\
    Open `Obsidian` →  `Settings` →  `Community Plugins` →  `Enable Obsidian GitLab Embeds`.

