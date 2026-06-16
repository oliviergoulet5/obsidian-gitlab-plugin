#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="gitlab-embeds"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

resolve_vault_path() {
  if [[ -n "${OBSIDIAN_VAULT:-}" ]]; then
    printf '%s' "${OBSIDIAN_VAULT}"
    return
  fi

  if [[ -t 0 ]]; then
    read -r -p "Path to your Obsidian vault: " vault_path
    if [[ -z "${vault_path}" ]]; then
      echo "Error: vault path is required." >&2
      exit 1
    fi
    printf '%s' "${vault_path}"
    return
  fi

  echo "Error: OBSIDIAN_VAULT is not set." >&2
  echo "Set it to your vault path, for example:" >&2
  echo "  OBSIDIAN_VAULT=/path/to/vault npm run link:vault" >&2
  exit 1
}

VAULT="$(resolve_vault_path)"
TARGET="${VAULT}/.obsidian/plugins/${PLUGIN_ID}"

if [[ ! -d "${VAULT}/.obsidian" ]]; then
  echo "Error: Obsidian vault not found at: ${VAULT}" >&2
  echo "Expected a .obsidian directory inside the vault." >&2
  exit 1
fi

mkdir -p "${VAULT}/.obsidian/plugins"

if [[ -e "${TARGET}" && ! -L "${TARGET}" ]]; then
  echo "Error: already exists and is not a symlink: ${TARGET}" >&2
  exit 1
fi

ln -sfn "${REPO_ROOT}" "${TARGET}"

echo "Linked ${TARGET} -> ${REPO_ROOT}"
echo "Run: npm run build   (or npm run dev for watch)"
echo "Enable plugin in Obsidian: Settings -> Community plugins -> GitLab Embeds"
