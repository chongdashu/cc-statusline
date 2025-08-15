import { cacheManager, generateContextHash } from '../utils/cache-manager.js'

export interface GitFeature {
  enabled: boolean
  showBranch: boolean
  showChanges: boolean
  compactMode: boolean
}

export function generateGitBashCode(config: GitFeature, colors: boolean): string {
  if (!config.enabled) return ''

  // Generate cache context for memory caching
  const cacheContext = generateContextHash(
    JSON.stringify(config),
    colors.toString(),
    'git_bash_code'
  )
  const cacheKey = cacheManager.generateCacheKey('git', cacheContext)

  // Check memory cache first
  const cachedResult = cacheManager.getFromMemory<string>(cacheKey)
  if (cachedResult) {
    return cachedResult
  }

  const colorCode = colors ? `
# ---- git colors ----
git_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[1;32m'; fi; }
rst() { if [ "$use_color" -eq 1 ]; then printf '\\033[0m'; fi; }
` : `
git_color() { :; }
rst() { :; }
`

  const bashCode = `${colorCode}
# ---- git ----
git_branch=""

# Process cache for git branch (avoid repeated calls within script)
${cacheManager.generateProcessCacheCode('git_branch', 'git symbolic-ref --short HEAD 2>/dev/null || git describe --always 2>/dev/null')}

# Repository detection cache (5 min TTL)  
repo_cache_file="\${HOME}/.claude/repo_cache_\${PWD//\\//_}.tmp"
repo_ttl=300
current_time=\$(date +%s)

if [ -f "\$repo_cache_file" ]; then
  repo_cache_time=\$(stat -c %Y "\$repo_cache_file" 2>/dev/null || echo 0)
  if [ \$((current_time - repo_cache_time)) -lt \$repo_ttl ]; then
    is_git_repo=\$(cat "\$repo_cache_file" 2>/dev/null)
  else
    rm -f "\$repo_cache_file" 2>/dev/null
  fi
fi

# Check if we're in a git repository (only if not cached)
if [ -z "\$is_git_repo" ]; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    is_git_repo="1"
    mkdir -p "\${HOME}/.claude" 2>/dev/null
    echo "1" > "\$repo_cache_file" 2>/dev/null
  else
    is_git_repo="0" 
    mkdir -p "\${HOME}/.claude" 2>/dev/null
    echo "0" > "\$repo_cache_file" 2>/dev/null
  fi
fi

# Get git branch only if in repository and not already cached
if [ "\$is_git_repo" = "1" ] && [ -z "\$git_branch" ]; then
  git_branch=\$(git symbolic-ref --short HEAD 2>/dev/null || git describe --always 2>/dev/null)
fi`

  // Cache the generated bash code in memory
  cacheManager.setInMemory(cacheKey, bashCode, 'git', cacheContext)
  
  return bashCode
}

export function generateGitDisplayCode(config: GitFeature, colors: boolean, emojis: boolean): string {
  if (!config.enabled) return ''

  const branchEmoji = emojis ? '🌿' : 'git:'
  const colorPrefix = colors ? '$(git_color)' : ''
  const colorSuffix = colors ? '$(rst)' : ''

  let displayCode = `
# git display
if [ -n "$git_branch" ]; then
  printf '  ${branchEmoji} %s%s%s' "${colorPrefix}" "$git_branch" "${colorSuffix}"
fi`

  return displayCode
}

export function generateGitUtilities(): string {
  return `
# git utilities
num_or_zero() { v="$1"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }

${cacheManager.generateCacheInitCode()}`
}