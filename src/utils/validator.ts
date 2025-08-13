import { StatuslineConfig } from '../cli/prompts.js'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateConfig(config: StatuslineConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate features
  if (!config.features || config.features.length === 0) {
    errors.push('At least one display feature must be selected')
  }

  // Validate runtime
  if (!['bash', 'python', 'node'].includes(config.runtime)) {
    errors.push(`Invalid runtime: ${config.runtime}`)
  }

  // Validate theme
  if (!['minimal', 'detailed', 'compact'].includes(config.theme)) {
    errors.push(`Invalid theme: ${config.theme}`)
  }

  // Check for usage features without ccusage integration
  const usageFeatures = ['usage', 'session', 'tokens', 'burnrate']
  const hasUsageFeatures = config.features.some(f => usageFeatures.includes(f))
  
  if (hasUsageFeatures && !config.ccusageIntegration) {
    warnings.push('Usage features selected but ccusage integration is disabled. Some features may not work properly.')
  }

  // Warn about performance with many features
  if (config.features.length > 5) {
    warnings.push('Many features selected. This may impact statusline performance.')
  }

  // Validate color/emoji consistency
  if (config.customEmojis && !config.colors) {
    warnings.push('Custom emojis enabled but colors disabled. Visual distinction may be limited.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export function validateDependencies(): {
  jq: boolean
  git: boolean
  ccusage: boolean
  python?: boolean
  node?: boolean
} {
  // This would check system dependencies
  // For now, return placeholder
  return {
    jq: true,  // Would check: command -v jq >/dev/null 2>&1
    git: true, // Would check: command -v git >/dev/null 2>&1
    ccusage: false, // Would check: command -v ccusage >/dev/null 2>&1
    python: true,   // Would check: command -v python3 >/dev/null 2>&1
    node: true      // Would check: command -v node >/dev/null 2>&1
  }
}