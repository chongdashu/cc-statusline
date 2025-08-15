import { createHash } from 'crypto'
import { StatuslineConfig } from '../cli/prompts.js'

/**
 * Pre-compiled bash segments for common features
 * These rarely change and can be cached for better performance
 */
export const TEMPLATE_FRAGMENTS = {
  colors: {
    enabled: `
# ---- color helpers (modern terminal-aware, respect NO_COLOR) ----
use_color=1

# Honor explicit environment variables
[ -n "$NO_COLOR" ] && use_color=0
[ -n "$FORCE_COLOR" ] && use_color=1

# Detect modern terminals (more permissive than TTY-only)
if [ "$use_color" -eq 1 ] && [ -z "$FORCE_COLOR" ]; then
  # Check for explicit color support indicators
  case "$TERM" in
    *color*|*-256color|xterm*|screen*|tmux*) 
      use_color=1 ;;
    dumb|unknown) 
      use_color=0 ;;
    *) 
      # Default to colors for modern environments (WSL, containers, etc.)
      # Only disable if we're definitely not in a capable terminal
      [ -t 1 ] || use_color=1  # Enable colors even for non-TTY if not explicitly disabled
      ;;
  esac
fi

C() { if [ "$use_color" -eq 1 ]; then printf '\\033[%sm' "$1"; fi; }
RST() { if [ "$use_color" -eq 1 ]; then printf '\\033[0m'; fi; }`,
    disabled: `
# ---- color helpers (disabled) ----
use_color=0
C() { :; }
RST() { :; }`
  },
  
  utilities: {
    timeHelpers: `
# ---- time helpers ----
to_epoch() {
  ts="$1"
  if command -v gdate >/dev/null 2>&1; then gdate -d "$ts" +%s 2>/dev/null && return; fi
  date -u -j -f "%Y-%m-%dT%H:%M:%S%z" "\${ts/Z/+0000}" +%s 2>/dev/null && return
  python3 - "$ts" <<'PY' 2>/dev/null
import sys, datetime
s=sys.argv[1].replace('Z','+00:00')
print(int(datetime.datetime.fromisoformat(s).timestamp()))
PY
}

fmt_time_hm() {
  epoch="$1"
  if date -r 0 +%s >/dev/null 2>&1; then date -r "$epoch" +"%H:%M"; else date -d "@$epoch" +"%H:%M"; fi
}

progress_bar() {
  pct="\${1:-0}"; width="\${2:-10}"
  [[ "$pct" =~ ^[0-9]+$ ]] || pct=0; ((pct<0))&&pct=0; ((pct>100))&&pct=100
  filled=$(( pct * width / 100 )); empty=$(( width - filled ))
  printf '%*s' "$filled" '' | tr ' ' '='
  printf '%*s' "$empty" '' | tr ' ' '-'
}`,
    
    jsonParsing: `
# ---- optimized json parsing ----
extract_json() {
  field="$1"
  fallback="$2"
  if command -v jq >/dev/null 2>&1; then
    echo "$input" | jq -r ".$field // \"$fallback\"" 2>/dev/null || echo "$fallback"
  else
    echo "$fallback"
  fi
}`,

    gitUtilities: `
# git utilities
num_or_zero() { v="$1"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }`
  }
} as const

/**
 * Most common feature combinations (80% of use cases)
 * These can be pre-compiled and cached for maximum performance
 */
export const COMMON_CONFIGS = [
  ['directory', 'model'],                    // Minimal
  ['directory', 'git', 'model'],            // Basic  
  ['directory', 'git', 'model', 'usage'],   // Standard
  ['directory', 'git', 'model', 'usage', 'session'] // Full
] as const

export type CommonConfigType = typeof COMMON_CONFIGS[number]

/**
 * Template cache for feature combinations
 */
export class TemplateCache {
  private fragmentCache = new Map<string, string>()
  private combinationCache = new Map<string, string>()
  
  /**
   * Generate optimized template key for caching
   */
  generateTemplateKey(config: StatuslineConfig): string {
    const keyComponents = {
      features: config.features.sort(), // Sort for consistent keys
      colors: config.colors,
      theme: config.theme,
      ccusage: config.ccusageIntegration,
      emojis: config.customEmojis,
      logging: config.logging
    }
    
    return createHash('md5')
      .update(JSON.stringify(keyComponents))
      .digest('hex')
      .substring(0, 12) // Longer hash for template keys
  }

  /**
   * Check if configuration matches a common pattern
   */
  isCommonConfig(features: string[]): CommonConfigType | null {
    const sortedFeatures = features.sort()
    
    for (const commonConfig of COMMON_CONFIGS) {
      const sortedCommon = [...commonConfig].sort()
      if (JSON.stringify(sortedFeatures) === JSON.stringify(sortedCommon)) {
        return commonConfig
      }
    }
    
    return null
  }

  /**
   * Get cached fragment by key
   */
  getCachedFragment(fragmentKey: string): string | null {
    return this.fragmentCache.get(fragmentKey) || null
  }

  /**
   * Cache a template fragment
   */
  setCachedFragment(fragmentKey: string, fragment: string): void {
    this.fragmentCache.set(fragmentKey, fragment)
  }

  /**
   * Get fragment key for colors
   */
  getColorFragmentKey(enabled: boolean): string {
    return `colors_${enabled ? 'enabled' : 'disabled'}`
  }

  /**
   * Get pre-compiled color fragment
   */
  getColorFragment(enabled: boolean): string {
    const key = this.getColorFragmentKey(enabled)
    const cached = this.getCachedFragment(key)
    
    if (cached) return cached
    
    const fragment = enabled ? TEMPLATE_FRAGMENTS.colors.enabled : TEMPLATE_FRAGMENTS.colors.disabled
    this.setCachedFragment(key, fragment)
    
    return fragment
  }

  /**
   * Get utilities fragment based on features
   */
  getUtilitiesFragment(hasUsage: boolean, hasGit: boolean): string {
    const key = `utilities_usage:${hasUsage}_git:${hasGit}`
    const cached = this.getCachedFragment(key)
    
    if (cached) return cached
    
    const parts: string[] = []
    
    if (hasUsage) {
      parts.push(TEMPLATE_FRAGMENTS.utilities.timeHelpers)
    }
    
    if (hasGit) {
      parts.push(TEMPLATE_FRAGMENTS.utilities.gitUtilities)
    }
    
    // Always include JSON parsing optimizations
    parts.push(TEMPLATE_FRAGMENTS.utilities.jsonParsing)
    
    const fragment = parts.join('\n')
    this.setCachedFragment(key, fragment)
    
    return fragment
  }

  /**
   * Get cached combination or null
   */
  getCachedCombination(templateKey: string): string | null {
    return this.combinationCache.get(templateKey) || null
  }

  /**
   * Cache a complete template combination
   */
  setCachedCombination(templateKey: string, template: string): void {
    // Limit combination cache size to prevent memory bloat
    if (this.combinationCache.size >= 50) {
      // Remove oldest entries (simple FIFO)
      const keys = Array.from(this.combinationCache.keys())
      for (let i = 0; i < 10; i++) {
        const key = keys[i]
        if (key !== undefined) {
          this.combinationCache.delete(key)
        }
      }
    }
    
    this.combinationCache.set(templateKey, template)
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.fragmentCache.clear()
    this.combinationCache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      fragmentCacheSize: this.fragmentCache.size,
      combinationCacheSize: this.combinationCache.size,
      fragmentKeys: Array.from(this.fragmentCache.keys()),
      combinationKeys: Array.from(this.combinationCache.keys())
    }
  }
}

// Global template cache instance
export const templateCache = new TemplateCache()

/**
 * Generate optimized bash statusline using template cache
 */
export function generateOptimizedBashStatusline(config: StatuslineConfig): string {
  const templateKey = templateCache.generateTemplateKey(config)
  
  // Check template cache first
  const cachedTemplate = templateCache.getCachedCombination(templateKey)
  if (cachedTemplate) {
    return cachedTemplate
  }
  
  // Check if this is a common configuration for additional optimizations
  const commonConfig = templateCache.isCommonConfig(config.features)
  if (commonConfig) {
    // For common configs, we can apply additional optimizations
    const optimizedTemplate = generateCommonConfigTemplate(config, commonConfig)
    templateCache.setCachedCombination(templateKey, optimizedTemplate)
    return optimizedTemplate
  }
  
  // Generate and cache custom template
  const customTemplate = generateCustomTemplate(config)
  if (customTemplate) {
    templateCache.setCachedCombination(templateKey, customTemplate)
    return customTemplate
  }
  
  return ''
}

/**
 * Generate optimized template for common configurations
 */
function generateCommonConfigTemplate(config: StatuslineConfig, commonConfig: CommonConfigType): string {
  // These are the most performance-critical paths
  // Use pre-compiled fragments where possible
  
  const features = new Set(config.features)
  const hasGit = features.has('git')
  const hasUsage = features.has('usage') || features.has('session') || features.has('tokens') || features.has('burnrate')
  
  const parts: string[] = [
    generateScriptHeader(config),
    config.logging ? generateLoggingCode() : '',
    'input=$(cat)',
    templateCache.getColorFragment(config.colors),
    config.colors ? generateBasicColors() : '',
    templateCache.getUtilitiesFragment(hasUsage, hasGit)
  ]
  
  // Add feature-specific code based on common config pattern
  switch (commonConfig.join(',')) {
    case 'directory,model':
      parts.push(generateBasicDataExtraction(true, true))
      break
    case 'directory,git,model':
      parts.push(generateBasicDataExtraction(true, true))
      parts.push(generateGitCode(config))
      break
    case 'directory,git,model,usage':
      parts.push(generateBasicDataExtraction(true, true))
      parts.push(generateGitCode(config))
      parts.push(generateUsageCode(config))
      break
    case 'directory,git,model,usage,session':
      parts.push(generateBasicDataExtraction(true, true))
      parts.push(generateGitCode(config))
      parts.push(generateUsageCode(config))
      break
  }
  
  parts.push(config.logging ? generateLoggingOutput() : '')
  parts.push(generateDisplaySection(config))
  
  return parts.filter(Boolean).join('\n') + '\n'
}

/**
 * Generate template for custom configurations
 */
function generateCustomTemplate(_config: StatuslineConfig): string | null {
  // For now, return null to let the fallback bash-generator handle it
  // This prevents circular dependency issues
  return null
}

// Helper functions (extracted from bash-generator.ts for reuse)
function generateScriptHeader(config: StatuslineConfig): string {
  const timestamp = new Date().toISOString()
  return `#!/bin/bash
# Generated by cc-statusline (https://www.npmjs.com/package/@chongdashu/cc-statusline)
# Custom Claude Code statusline - Created: ${timestamp}
# Theme: ${config.theme} | Colors: ${config.colors} | Features: ${config.features.join(', ')}`
}

function generateLoggingCode(): string {
  return `
LOG_FILE="\${HOME}/.claude/statusline.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ---- logging ----
{
  echo "[$TIMESTAMP] Status line triggered with input:"
  (echo "$input" | jq . 2>/dev/null) || echo "$input"
  echo "---"
} >> "$LOG_FILE" 2>/dev/null
`
}

function generateBasicColors(): string {
  return `
# ---- basic colors ----
dir_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[1;36m'; fi; }    # cyan
model_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[1;35m'; fi; }  # magenta  
version_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[1;33m'; fi; } # yellow
rst() { if [ "$use_color" -eq 1 ]; then printf '\\033[0m'; fi; }
`
}

function generateBasicDataExtraction(hasDirectory: boolean, hasModel: boolean): string {
  if (!hasDirectory && !hasModel) return ''
  
  const jqFields: string[] = []
  const fallbackVars: string[] = []
  
  if (hasDirectory) {
    jqFields.push('current_dir: (.workspace.current_dir // .cwd // "unknown")')
    fallbackVars.push('current_dir="unknown"')
  }
  
  if (hasModel) {
    jqFields.push('model_name: (.model.display_name // "Claude")')
    jqFields.push('model_version: (.model.version // "")')
    fallbackVars.push('model_name="Claude"; model_version=""')
  }

  const jqQuery = `{${jqFields.join(', ')}}`
  
  return `
# ---- basics ----
if command -v jq >/dev/null 2>&1; then
  eval "$(echo "$input" | jq -r '${jqQuery} | to_entries | .[] | "\\(.key)=\\(.value | @sh)"' 2>/dev/null)"${hasDirectory ? `
  current_dir=$(echo "$current_dir" | sed "s|^$HOME|~|g")` : ''}
else
  ${fallbackVars.join('; ')}
fi
`
}

function generateGitCode(_config: StatuslineConfig): string {
  // Simplified git code for common configs
  return `
# ---- git ----
git_branch=""
if git rev-parse --git-dir >/dev/null 2>&1; then
  git_branch=$(git symbolic-ref --short HEAD 2>/dev/null || git describe --always 2>/dev/null)
fi`
}

function generateUsageCode(_config: StatuslineConfig): string {
  // Simplified usage code for common configs
  return `
# ---- ccusage integration ----
session_txt=""; session_pct=0; cost_usd=""; cost_per_hour=""; tpm=""; tot_tokens=""

if command -v jq >/dev/null 2>&1; then
  blocks_output=$(ccusage blocks --json 2>/dev/null || timeout 3 npx ccusage@latest blocks --json 2>/dev/null)
  if [ -n "$blocks_output" ]; then
    eval "$(echo "$blocks_output" | jq -r '.blocks[] | select(.isActive == true) | {cost_usd: (.costUSD // ""), cost_per_hour: (.burnRate.costPerHour // ""), tot_tokens: (.totalTokens // ""), tpm: (.burnRate.tokensPerMinute // "")} | to_entries | .[] | "\\(.key)=\\(.value | @sh)"' 2>/dev/null)" 2>/dev/null
  fi
fi`
}

function generateLoggingOutput(): string {
  return `
# ---- log extracted data ----
{
  echo "[\$TIMESTAMP] Extracted: dir=\${current_dir:-}, model=\${model_name:-}, version=\${model_version:-}, git=\${git_branch:-}, cost=\${cost_usd:-}, cost_ph=\${cost_per_hour:-}, tokens=\${tot_tokens:-}, tpm=\${tpm:-}, session_pct=\${session_pct:-}"
} >> "$LOG_FILE" 2>/dev/null
`
}

function generateDisplaySection(config: StatuslineConfig): string {
  const emojis = config.colors && !config.customEmojis
  const features = new Set(config.features)

  let displayCode = `
# ---- render statusline ----`

  // Directory
  if (features.has('directory')) {
    const dirEmoji = emojis ? '📁' : 'dir:'
    const dirColorPrefix = config.colors ? '$(dir_color)' : ''
    const dirColorSuffix = config.colors ? '$(rst)' : ''
    displayCode += `
printf '${dirEmoji} %s%s%s' "${dirColorPrefix}" "$current_dir" "${dirColorSuffix}"`
  }

  // Model
  if (features.has('model')) {
    const modelEmoji = emojis ? '🤖' : 'model:'
    const modelColorPrefix = config.colors ? '$(model_color)' : ''
    const modelColorSuffix = config.colors ? '$(rst)' : ''
    displayCode += `
printf '  ${modelEmoji} %s%s%s' "${modelColorPrefix}" "$model_name" "${modelColorSuffix}"`
  }

  // Git
  if (features.has('git')) {
    const branchEmoji = emojis ? '🌿' : 'git:'
    const colorPrefix = config.colors ? '$(git_color)' : ''
    const colorSuffix = config.colors ? '$(rst)' : ''
    displayCode += `
if [ -n "$git_branch" ]; then
  printf '  ${branchEmoji} %s%s%s' "${colorPrefix}" "$git_branch" "${colorSuffix}"
fi`
  }

  // Usage/Cost
  if (features.has('usage')) {
    const costEmoji = emojis ? '💵' : '$'
    displayCode += `
if [ -n "$cost_usd" ] && [[ "$cost_usd" =~ ^[0-9.]+$ ]]; then
  if [ -n "$cost_per_hour" ] && [[ "$cost_per_hour" =~ ^[0-9.]+$ ]]; then
    printf '  ${costEmoji} %s$%.2f ($%.2f/h)%s' "$(cost_color)" "$cost_usd" "$cost_per_hour" "$(rst)"
  else
    printf '  ${costEmoji} %s$%.2f%s' "$(cost_color)" "$cost_usd" "$(rst)"
  fi
fi`
  }

  return displayCode
}