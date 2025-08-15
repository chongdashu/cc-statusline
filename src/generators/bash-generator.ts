import { StatuslineConfig } from '../cli/prompts.js'
import { generateColorBashCode, generateBasicColors } from '../features/colors.js'
import { generateGitBashCode, generateGitDisplayCode, generateGitUtilities } from '../features/git.js'
import { generateUsageBashCode, generateUsageDisplayCode, generateUsageUtilities } from '../features/usage.js'
import { generateSystemBashCode, generateSystemDisplayCode, generateSystemUtilities, SystemFeature } from '../features/system.js'
import { cacheManager, generateFeatureHash } from '../utils/cache-manager.js'
import { generateOptimizedBashStatusline } from './template-cache.js'
import { optimizeBashCode, getOptimizationStats } from './bash-optimizer.js'

export function generateBashStatusline(config: StatuslineConfig): string {
  const startTime = Date.now()
  
  // Use the new optimized template cache system first
  const cachedScript = generateOptimizedBashStatusline(config)
  if (cachedScript) {
    // Update performance metrics
    const generationTime = Date.now() - startTime
    cacheManager.updateMetrics({
      scriptSize: cachedScript.length,
      generationTime,
      featureComplexity: config.features.length
    })
    return cachedScript
  }
  
  // Fallback to original template-level caching for edge cases
  const templateHash = generateFeatureHash(config.features, {
    colors: config.colors,
    theme: config.theme,
    ccusageIntegration: config.ccusageIntegration,
    customEmojis: config.customEmojis,
    logging: config.logging
  })
  const templateCacheKey = cacheManager.generateCacheKey('template', templateHash)
  
  // Check memory cache for complete script
  const memoryScript = cacheManager.getFromMemory<string>(templateCacheKey)
  if (memoryScript) {
    return memoryScript
  }

  // Pre-compute feature flags for better performance
  const features = new Set(config.features)
  const hasGit = features.has('git')
  const hasUsage = features.has('usage') || features.has('session') || features.has('tokens') || features.has('burnrate')
  const hasSystem = features.has('cpu') || features.has('memory') || features.has('load')
  const hasDirectory = features.has('directory')
  const hasModel = features.has('model')

  // Build feature configs once
  const usageConfig = {
    enabled: hasUsage && config.ccusageIntegration,
    showCost: features.has('usage'),
    showTokens: features.has('tokens'),
    showBurnRate: features.has('burnrate'),
    showSession: features.has('session'),
    showProgressBar: config.theme !== 'minimal' && features.has('session')
  }

  const gitConfig = {
    enabled: hasGit,
    showBranch: hasGit,
    showChanges: false,
    compactMode: config.theme === 'compact'
  }

  const systemConfig: SystemFeature = {
    enabled: hasSystem,
    showCPU: features.has('cpu'),
    showRAM: features.has('memory'),
    showLoad: features.has('load'),
    refreshRate: config.systemMonitoring?.refreshRate || 3,
    displayFormat: config.theme === 'compact' ? 'compact' as const : 'detailed' as const,
    ...(config.systemMonitoring && {
      thresholds: {
        cpuThreshold: config.systemMonitoring.cpuThreshold,
        memoryThreshold: config.systemMonitoring.memoryThreshold,
        loadThreshold: config.systemMonitoring.loadThreshold
      }
    })
  }

  // Use array for better performance than string concatenation
  const parts: string[] = [
    generateScriptHeader(config),
    config.logging ? generateLoggingCode() : '',
    'input=$(cat)',
    generateColorBashCode({ enabled: config.colors, theme: config.theme }),
    config.colors ? generateBasicColors() : '',
    hasUsage ? generateUsageUtilities() : '',
    hasGit ? generateGitUtilities() : '',
    hasSystem ? generateSystemUtilities() : '',
    generateBasicDataExtraction(hasDirectory, hasModel),
    hasGit ? generateGitBashCode(gitConfig, config.colors) : '',
    hasUsage ? generateUsageBashCode(usageConfig, config.colors) : '',
    hasSystem ? generateSystemBashCode(systemConfig, config.colors) : '',
    config.logging ? generateLoggingOutput() : '',
    generateDisplaySection(config, gitConfig, usageConfig, systemConfig)
  ]

  // Filter empty parts and join efficiently
  const rawScript = parts.filter(Boolean).join('\n') + '\n'
  
  // Apply final micro-optimizations to the complete script
  const optimizedScript = optimizeBashCode(rawScript)
  
  // Get optimization statistics for performance monitoring
  const stats = getOptimizationStats(rawScript, optimizedScript)
  
  // Cache the optimized script and update performance metrics
  const generationTime = Date.now() - startTime
  cacheManager.setInMemory(templateCacheKey, optimizedScript, 'template', templateHash)
  cacheManager.updateMetrics({
    scriptSize: optimizedScript.length,
    generationTime,
    featureComplexity: config.features.length
  })
  
  // Log optimization results if in debug mode
  if (process.env.CC_STATUSLINE_DEBUG === '1') {
    console.log(`Script optimization: ${stats.reductionPercent}% size reduction (${stats.originalSize} → ${stats.optimizedSize} bytes)`)
  }
  
  return optimizedScript
}

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

function generateBasicDataExtraction(hasDirectory: boolean, hasModel: boolean): string {
  // Optimize JSON parsing with single jq call when possible
  if (!hasDirectory && !hasModel) return ''
  
  const jqFields: string[] = []
  const fallbackVars: string[] = []
  
  if (hasDirectory) {
    jqFields.push('cwd: (.workspace.current_dir // .cwd // "unknown")')
    fallbackVars.push('cwd="unknown"')
  }
  
  if (hasModel) {
    jqFields.push('model_name: (.model.display_name // "Claude")')
    jqFields.push('model_version: (.model.version // "")')
    fallbackVars.push('model_name="Claude"; model_version=""')
  }

  const jqQuery = `{${jqFields.join(', ')}}`
  
  const bashCode = `
# ---- basics ----
if command -v jq >/dev/null 2>&1; then
  eval "$(echo "$input" | jq -r '${jqQuery} | to_entries | .[] | "\\(.key)=\\(.value | @sh)"' 2>/dev/null)"${hasDirectory ? `
  cwd=\${cwd/#$HOME/~}` : ''}
else
  ${fallbackVars.join('; ')}
fi
`

  return optimizeBashCode(bashCode)
}

function generateLoggingOutput(): string {
  const bashCode = `
# ---- log extracted data ----
{
  echo "[\$TIMESTAMP] Extracted: dir=\${cwd:-}, model=\${model_name:-}, version=\${model_version:-}, git=\${git_branch:-}, cost=\${cost_usd:-}, cost_ph=\${cost_ph:-}, tokens=\${tot_tokens:-}, tpm=\${tpm:-}, pct=\${pct:-}"
} >> "$LOG_FILE" 2>/dev/null
`

  return optimizeBashCode(bashCode)
}

function generateDisplaySection(config: StatuslineConfig, gitConfig: any, usageConfig: any, systemConfig: any): string {
  const emojis = config.colors && !config.customEmojis
  const features = new Set(config.features)

  // Logical feature ordering (grouped by context)
  const featurePriority = [
    'directory',  // 1. Where am I?
    'git',        // 2. What branch/commit?
    'model',      // 3. What model am I using?
    'cpu',        // 4. System performance
    'memory',
    'load',
    'usage',      // 5. Usage & cost info
    'session',
    'tokens', 
    'burnrate'
  ]

  let displayCode = `
# ---- render statusline ----`

  // Render features in priority order
  for (const feature of featurePriority) {
    if (!features.has(feature)) continue

    switch (feature) {
      case 'directory':
        const dirEmoji = emojis ? '📁' : 'dir:'
        const dirColorPrefix = config.colors ? '$(dir_clr)' : ''
        const dirColorSuffix = config.colors ? '$(rst)' : ''
        displayCode += `
printf '${dirEmoji} %s%s%s' "${dirColorPrefix}" "$cwd" "${dirColorSuffix}"`
        break

      case 'model':
        const modelEmoji = emojis ? '🤖' : 'model:'
        const modelColorPrefix = config.colors ? '$(model_clr)' : ''
        const modelColorSuffix = config.colors ? '$(rst)' : ''
        displayCode += `
printf '  ${modelEmoji} %s%s%s' "${modelColorPrefix}" "$model_name" "${modelColorSuffix}"`
        break

      case 'git':
        displayCode += generateGitDisplayCode(gitConfig, config.colors, emojis)
        break

      case 'cpu':
      case 'memory':
      case 'load':
        // Only add system display once
        if (feature === 'cpu' || (!features.has('cpu') && feature === 'memory') || (!features.has('cpu') && !features.has('memory') && feature === 'load')) {
          displayCode += generateSystemDisplayCode(systemConfig, emojis)
        }
        break

      case 'usage':
      case 'session':
      case 'tokens':
      case 'burnrate':
        // Only add usage display once
        if (feature === 'usage' || (!features.has('usage') && feature === 'session')) {
          displayCode += generateUsageDisplayCode(usageConfig, emojis)
        }
        break
    }
  }

  return optimizeBashCode(displayCode)
}