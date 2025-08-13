export interface GitFeature {
  enabled: boolean
  showBranch: boolean
  showChanges: boolean
  compactMode: boolean
}

export function generateGitBashCode(config: GitFeature, colors: boolean): string {
  if (!config.enabled) return ''

  const colorCode = colors ? `
# ---- git colors ----
git_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[1;32m'; fi; }
rst() { if [ "$use_color" -eq 1 ]; then printf '\\033[0m'; fi; }
` : `
git_color() { :; }
rst() { :; }
`

  return `${colorCode}
# ---- git ----
git_branch=""
if git rev-parse --git-dir >/dev/null 2>&1; then
  git_branch=$(git branch --show-current 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
fi`
}

export function generateGitDisplayCode(config: GitFeature, colors: boolean, emojis: boolean): string {
  if (!config.enabled) return ''

  const branchEmoji = emojis ? '🌿' : 'git:'

  let displayCode = `
# git display
if [ -n "$git_branch" ]; then
  printf '  ${branchEmoji} %s%s%s' "$(git_color)" "$git_branch" "$(rst)"
fi`

  return displayCode
}

export function generateGitUtilities(): string {
  return `
# git utilities
num_or_zero() { v="$1"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }`
}