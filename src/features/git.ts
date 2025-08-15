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

# Check git cache first (10s TTL)
git_cache_file="\${HOME}/.claude/git_cache_\${PWD//\\//_}.tmp"
cache_ttl=10
current_time=\$(date +%s)

if [ -f "\$git_cache_file" ]; then
  cache_time=\$(stat -c %Y "\$git_cache_file" 2>/dev/null || echo 0)
  if [ \$((current_time - cache_time)) -lt \$cache_ttl ]; then
    git_branch=\$(cat "\$git_cache_file" 2>/dev/null)
  fi
fi

# If no cached result or cache expired, fetch git info
if [ -z "\$git_branch" ]; then
  # Repository detection cache (5 min TTL)  
  repo_cache_file="\${HOME}/.claude/repo_cache_\${PWD//\\//_}.tmp"
  repo_ttl=300
  
  if [ -f "\$repo_cache_file" ]; then
    repo_cache_time=\$(stat -c %Y "\$repo_cache_file" 2>/dev/null || echo 0)
    if [ \$((current_time - repo_cache_time)) -lt \$repo_ttl ]; then
      is_git_repo=\$(cat "\$repo_cache_file" 2>/dev/null)
    else
      rm -f "\$repo_cache_file" 2>/dev/null
    fi
  fi
  
  # Check if we're in a git repository
  if [ -z "\$is_git_repo" ]; then
    if git rev-parse --git-dir >/dev/null 2>&1; then
      is_git_repo="1"
      echo "1" > "\$repo_cache_file" 2>/dev/null
    else
      is_git_repo="0" 
      echo "0" > "\$repo_cache_file" 2>/dev/null
    fi
  fi
  
  # Single optimized git command if in repository
  if [ "\$is_git_repo" = "1" ]; then
    git_branch=\$(git symbolic-ref --short HEAD 2>/dev/null || git describe --always 2>/dev/null)
    # Cache the result
    if [ -n "\$git_branch" ]; then
      mkdir -p "\${HOME}/.claude" 2>/dev/null
      echo "\$git_branch" > "\$git_cache_file" 2>/dev/null
    fi
  fi
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
num_or_zero() { v="$1"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }

# git cache cleanup (remove stale cache files older than 1 hour)
cleanup_git_cache() {
  if [ -d "\${HOME}/.claude" ]; then
    find "\${HOME}/.claude" -name "git_cache_*.tmp" -mmin +60 -delete 2>/dev/null
    find "\${HOME}/.claude" -name "repo_cache_*.tmp" -mmin +360 -delete 2>/dev/null
  fi
}

# Initialize cache directory
mkdir -p "\${HOME}/.claude" 2>/dev/null

# Cleanup old cache files (run occasionally to prevent accumulation)
if [ "\$((\$(date +%s) % 100))" -eq 0 ]; then
  cleanup_git_cache
fi`
}