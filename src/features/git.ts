import { cacheManager, generateContextHash } from '../utils/cache-manager.js'
import { optimizeBashCode } from '../generators/bash-optimizer.js'

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
git_clr() { [[ $use_color -eq 1 ]] && printf '\\033[1;32m'; }
rst() { [[ $use_color -eq 1 ]] && printf '\\033[0m'; }
` : `
git_clr() { :; }
rst() { :; }
`

  const bashCode = `${colorCode}
# ---- git ----
git_branch=""

# Process cache for git branch (avoid repeated calls within script)
${cacheManager.generateProcessCacheCode('git_branch', 'git symbolic-ref --short HEAD 2>/dev/null || git describe --always 2>/dev/null')}

# Repository detection cache (5 min TTL)  
repo_cache="\${HOME}/.claude/repo_\${PWD//\\//_}.tmp"
ttl=300
now=\${EPOCHSECONDS:-\$(date +%s)}

if [[ -f $repo_cache ]]; then
  cache_time=\$(stat -c %Y "\$repo_cache" 2>/dev/null || echo 0)
  if (( now - cache_time < ttl )); then
    is_git_repo=\$(<"\$repo_cache")
  else
    rm -f "\$repo_cache" 2>/dev/null
  fi
fi

# Check if we're in a git repository (only if not cached)
if [[ ! $is_git_repo ]]; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    is_git_repo="1"
    mkdir -p "\${HOME}/.claude" 2>/dev/null
    echo "1" > "\$repo_cache" 2>/dev/null
  else
    is_git_repo="0" 
    mkdir -p "\${HOME}/.claude" 2>/dev/null
    echo "0" > "\$repo_cache" 2>/dev/null
  fi
fi

# Get git branch only if in repository and not already cached
if [[ $is_git_repo == "1" && ! $git_branch ]]; then
  git_branch=\$(git symbolic-ref --short HEAD 2>/dev/null || git describe --always 2>/dev/null)
fi`

  // Apply micro-optimizations before caching
  const optimizedCode = optimizeBashCode(bashCode)
  
  // Cache the optimized bash code in memory
  cacheManager.setInMemory(cacheKey, optimizedCode, 'git', cacheContext)
  
  return optimizedCode
}

export function generateGitDisplayCode(config: GitFeature, colors: boolean, emojis: boolean): string {
  if (!config.enabled) return ''

  const branchEmoji = emojis ? '🌿' : 'git:'
  const colorPrefix = colors ? '$(git_clr)' : ''
  const colorSuffix = colors ? '$(rst)' : ''

  let displayCode = `
# git display
if [[ $git_branch ]]; then
  printf '  ${branchEmoji} %s%s%s' "${colorPrefix}" "$git_branch" "${colorSuffix}"
fi`

  return optimizeBashCode(displayCode)
}

export function generateGitUtilities(): string {
  const utilities = `
# git utilities
num_or_zero() { v="$1"; [[ $v =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }

${cacheManager.generateCacheInitCode()}`

  return optimizeBashCode(utilities)
}