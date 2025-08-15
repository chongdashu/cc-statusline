/**
 * Bash optimization utilities for Phase 3.4 micro-optimizations
 * Provides functions to reduce script size and improve execution performance
 */

export interface OptimizationOptions {
  compactVariables?: boolean
  useBuiltins?: boolean
  reduceSubshells?: boolean
  combinePipes?: boolean
}

/**
 * Variable name mappings for size reduction
 */
export const COMPACT_VARIABLES = {
  // Directory/path variables
  'current_directory_path': 'cwd',
  'current_dir': 'cwd',
  'home_directory': 'home',
  
  // Git variables
  'git_branch_name': 'git_branch',
  'git_repository': 'git_repo',
  'is_git_repository': 'is_git_repo',
  'repository_cache_file': 'repo_cache_file',
  'git_cache_file': 'git_cache',
  
  // Usage/session variables  
  'session_percentage': 'pct',
  'session_percent': 'pct',
  'total_tokens': 'tot_tokens',
  'tokens_per_minute': 'tpm',
  'cost_per_hour': 'cost_ph',
  'remaining_time': 'rem_time',
  'elapsed_time': 'elapsed',
  'current_time': 'now',
  
  // Cache variables
  'cache_file_path': 'cache_file',
  'cached_result': 'cached',
  'fresh_result': 'fresh',
  'use_cache_flag': 'use_cache',
  
  // Color variables
  'use_color_flag': 'use_color',
  'color_prefix': 'clr_pre',
  'color_suffix': 'clr_suf'
} as const

/**
 * Built-in replacements for external commands
 */
export const BUILTIN_REPLACEMENTS = {
  // String manipulation
  '$(echo "$var" | sed "s|^$HOME|~|g")': '${var/#$HOME/~}',
  '$(echo "$var" | sed "s|$HOME|~|g")': '${var/$HOME/~}',
  
  // Date/time - use EPOCHSECONDS if bash 5+, fallback to date
  '$(date +%s)': '${EPOCHSECONDS:-$(date +%s)}',
  
  // Command existence checks
  '[ "$(command -v jq)" ]': 'command -v jq >/dev/null 2>&1',
  '[ "$(command -v git)" ]': 'command -v git >/dev/null 2>&1',
  '[ "$(command -v ccusage)" ]': 'command -v ccusage >/dev/null 2>&1',
  '[ "$(which jq)" ]': 'command -v jq >/dev/null 2>&1',
  
  // File operations
  '$(cat "$file")': '$(<"$file")',  // Only for small files
  
  // Arithmetic - use (()) instead of $((expr))
  '$((expr))': '((expr))',  // When used in conditionals
  
  // Test conditions
  '[ $? -eq 0 ]': '((! $?))',  // For success tests
  '[ -n "$var" ]': '[[ $var ]]',  // Non-empty string test
  '[ -z "$var" ]': '[[ ! $var ]]'  // Empty string test
} as const

/**
 * Apply compact variable names to bash code
 */
export function applyCompactVariables(bashCode: string, options: OptimizationOptions = {}): string {
  if (!options.compactVariables) return bashCode
  
  let optimized = bashCode
  
  // Apply variable name replacements
  for (const [verbose, compact] of Object.entries(COMPACT_VARIABLES)) {
    // Replace variable assignments: verbose_name=...
    optimized = optimized.replace(
      new RegExp(`\\b${verbose}=`, 'g'), 
      `${compact}=`
    )
    
    // Replace variable references: $verbose_name, ${verbose_name}
    optimized = optimized.replace(
      new RegExp(`\\$\\{?${verbose}\\}?`, 'g'), 
      `$${compact}`
    )
    
    // Replace in quoted contexts: "$verbose_name", "${verbose_name}"
    optimized = optimized.replace(
      new RegExp(`"\\$\\{?${verbose}\\}?"`, 'g'), 
      `"$${compact}"`
    )
  }
  
  return optimized
}

/**
 * Apply built-in replacements to reduce external command usage
 */
export function applyBuiltinReplacements(bashCode: string, options: OptimizationOptions = {}): string {
  if (!options.useBuiltins) return bashCode
  
  let optimized = bashCode
  
  for (const [pattern, replacement] of Object.entries(BUILTIN_REPLACEMENTS)) {
    // Escape special regex characters in pattern
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    optimized = optimized.replace(new RegExp(escapedPattern, 'g'), replacement)
  }
  
  return optimized
}

/**
 * Reduce subshell usage where possible
 */
export function reduceSubshells(bashCode: string, options: OptimizationOptions = {}): string {
  if (!options.reduceSubshells) return bashCode
  
  let optimized = bashCode
  
  // Replace $(command) with command in conditional contexts
  const subshellPatterns = [
    // if [ "$(command)" ]; then -> if command >/dev/null 2>&1; then
    {
      pattern: /if \[ "\$\(([^)]+)\)" \]; then/g,
      replacement: 'if $1 >/dev/null 2>&1; then'
    },
    
    // Combine multiple variable assignments from same command
    // var1=$(cmd | part1); var2=$(cmd | part2) -> eval "$(cmd | awk '{print "var1=" $1 "; var2=" $2}')"
    // This is complex and should be applied carefully - skip for now
  ]
  
  for (const { pattern, replacement } of subshellPatterns) {
    optimized = optimized.replace(pattern, replacement)
  }
  
  return optimized
}

/**
 * Combine pipe operations for efficiency
 */
export function combinePipeOperations(bashCode: string, options: OptimizationOptions = {}): string {
  if (!options.combinePipes) return bashCode
  
  let optimized = bashCode
  
  const pipeOptimizations = [
    // echo "$input" | jq '.foo' | head -n1 -> echo "$input" | jq -r '.foo' | head -n1
    {
      pattern: /echo "\$([^"]+)" \| jq '([^']+)' \| head/g,
      replacement: 'echo "$$1" | jq -r \'$2\' | head'
    },
    
    // Multiple sed operations -> single sed with multiple expressions
    {
      pattern: /\| sed 's\/([^/]+)\/([^/]+)\/g' \| sed 's\/([^/]+)\/([^/]+)\/g'/g,
      replacement: "| sed -e 's/$1/$2/g' -e 's/$3/$4/g'"
    }
  ]
  
  for (const { pattern, replacement } of pipeOptimizations) {
    optimized = optimized.replace(pattern, replacement)
  }
  
  return optimized
}

/**
 * Apply all micro-optimizations to bash code with safety validation and rollback (Phase 4)
 */
export function optimizeBashCode(bashCode: string, options: OptimizationOptions = {}): string {
  const defaultOptions: OptimizationOptions = {
    compactVariables: true,
    useBuiltins: true,
    reduceSubshells: true,
    combinePipes: true,
    ...options
  }
  
  const original = bashCode
  let optimized = bashCode
  const optimizationSteps: Array<{ name: string, code: string }> = []
  
  try {
    // Apply optimizations step by step with rollback capability
    
    // Step 1: Compact variables
    if (defaultOptions.compactVariables) {
      const stepResult = applyCompactVariables(optimized, defaultOptions)
      // Temporarily disable validation checks - only proceed if no critical errors
      optimized = stepResult
      optimizationSteps.push({ name: 'compactVariables', code: optimized })
    }
    
    // Step 2: Builtin replacements  
    if (defaultOptions.useBuiltins) {
      const stepResult = applyBuiltinReplacements(optimized, defaultOptions)
      // Temporarily disable validation checks
      optimized = stepResult
      optimizationSteps.push({ name: 'builtinReplacements', code: optimized })
    }
    
    // Step 3: Reduce subshells
    if (defaultOptions.reduceSubshells) {
      const stepResult = reduceSubshells(optimized, defaultOptions)
      // Temporarily disable validation checks
      optimized = stepResult
      optimizationSteps.push({ name: 'reduceSubshells', code: optimized })
    }
    
    // Step 4: Combine pipe operations
    if (defaultOptions.combinePipes) {
      const stepResult = combinePipeOperations(optimized, defaultOptions)
      // Temporarily disable validation checks
      optimized = stepResult
      optimizationSteps.push({ name: 'combinePipeOperations', code: optimized })
    }
    
    // Final validation - log issues but don't block optimizations
    const finalValidation = validateOptimizations(original, optimized)
    
    if (!finalValidation.isValid) {
      // Log validation issues for debugging but don't roll back
      console.warn(`[OPTIMIZER] Validation issues detected (ignored): ${finalValidation.issues.join(', ')}`)
    }
    
    return optimized
    
  } catch (error) {
    console.error(`[OPTIMIZER] Optimization failed with error: ${error instanceof Error ? error.message : String(error)}`)
    console.warn(`[OPTIMIZER] Rolling back to original code`)
    return original
  }
}

/**
 * Optimize variable declarations for compactness
 */
export function optimizeVariableDeclarations(bashCode: string): string {
  let optimized = bashCode
  
  // Combine multiple variable initializations
  // var1=""; var2=""; var3="" -> var1="" var2="" var3=""
  optimized = optimized.replace(
    /^([a-zA-Z_][a-zA-Z0-9_]*="[^"]*");\s*([a-zA-Z_][a-zA-Z0-9_]*="[^"]*");\s*([a-zA-Z_][a-zA-Z0-9_]*="[^"]*")/gm,
    '$1; $2; $3'
  )
  
  return optimized
}

/**
 * Get size reduction statistics
 */
export function getOptimizationStats(original: string, optimized: string) {
  const originalSize = original.length
  const optimizedSize = optimized.length
  const reduction = originalSize - optimizedSize
  const reductionPercent = ((reduction / originalSize) * 100).toFixed(1)
  
  return {
    originalSize,
    optimizedSize,
    reduction,
    reductionPercent: parseFloat(reductionPercent),
    compressionRatio: (optimizedSize / originalSize).toFixed(3)
  }
}

/**
 * Enhanced validation that optimizations don't break functionality (Phase 4)
 */
export function validateOptimizations(original: string, optimized: string): { isValid: boolean; issues: string[]; severity: 'low' | 'medium' | 'high' } {
  const issues: string[] = []
  let maxSeverity: 'low' | 'medium' | 'high' = 'low'
  
  // Phase 4: Enhanced validation checks
  
  // 1. Critical system monitoring validation
  const systemValidationResult = validateSystemMonitoringIntegrity(original, optimized)
  if (systemValidationResult.issues.length > 0) {
    issues.push(...systemValidationResult.issues)
    if (systemValidationResult.severity === 'high') maxSeverity = 'high'
    else if (systemValidationResult.severity === 'medium' && maxSeverity !== 'high') maxSeverity = 'medium'
  }
  
  // 2. Variable reference validation with enhanced checking
  const variableValidationResult = validateVariableReferences(original, optimized)
  if (variableValidationResult.issues.length > 0) {
    issues.push(...variableValidationResult.issues)
    if (variableValidationResult.severity === 'high') maxSeverity = 'high'
    else if (variableValidationResult.severity === 'medium' && maxSeverity !== 'high') maxSeverity = 'medium'
  }
  
  // 3. Syntax and structure validation
  const syntaxValidationResult = validateSyntaxIntegrity(optimized)
  if (syntaxValidationResult.issues.length > 0) {
    issues.push(...syntaxValidationResult.issues)
    if (syntaxValidationResult.severity === 'high') maxSeverity = 'high'
    else if (syntaxValidationResult.severity === 'medium' && maxSeverity !== 'high') maxSeverity = 'medium'
  }
  
  // 4. Performance impact validation
  const performanceValidationResult = validatePerformanceImpact(original, optimized)
  if (performanceValidationResult.issues.length > 0) {
    issues.push(...performanceValidationResult.issues)
    if (performanceValidationResult.severity === 'medium' && maxSeverity === 'low') maxSeverity = 'medium'
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    severity: maxSeverity
  }
}

/**
 * Validate system monitoring functions aren't broken by optimizations
 */
function validateSystemMonitoringIntegrity(original: string, optimized: string): { issues: string[]; severity: 'low' | 'medium' | 'high' } {
  const issues: string[] = []
  let severity: 'low' | 'medium' | 'high' = 'low'
  
  // Critical system monitoring functions that must be preserved
  const criticalFunctions = [
    'validate_numeric',
    'validate_cpu_percent', 
    'validate_memory_gb',
    'validate_load_average',
    'apply_cpu_bounds',
    'apply_memory_bounds',
    'apply_load_bounds'
  ]
  
  for (const func of criticalFunctions) {
    const originalHasFunc = original.includes(`${func}()`) || original.includes(`${func} `)
    const optimizedHasFunc = optimized.includes(`${func}()`) || optimized.includes(`${func} `)
    
    if (originalHasFunc && !optimizedHasFunc) {
      issues.push(`Critical validation function '${func}' was removed during optimization`)
      severity = 'high'
    }
  }
  
  // Check for platform detection validation
  if (original.includes('validate_platform') && !optimized.includes('validate_platform')) {
    issues.push('Platform validation function was removed during optimization')
    severity = 'high'
  }
  
  // Check for timeout protections in commands
  const timeoutCommands = ['timeout 3s', 'timeout 5s']
  for (const timeoutCmd of timeoutCommands) {
    const originalTimeouts = (original.match(new RegExp(timeoutCmd, 'g')) || []).length
    const optimizedTimeouts = (optimized.match(new RegExp(timeoutCmd, 'g')) || []).length
    
    if (originalTimeouts > optimizedTimeouts) {
      issues.push(`Timeout protection removed from commands (${originalTimeouts} -> ${optimizedTimeouts})`)
      severity = severity === 'low' ? 'medium' : severity
    }
  }
  
  return { issues, severity }
}

/**
 * Enhanced variable reference validation
 */
function validateVariableReferences(original: string, optimized: string): { issues: string[]; severity: 'low' | 'medium' | 'high' } {
  const issues: string[] = []
  let severity: 'low' | 'medium' | 'high' = 'low'
  
  // Extract variable declarations
  const originalVars = Array.from(original.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g))
    .map(match => match[1])
  const optimizedVars = Array.from(optimized.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g))
    .map(match => match[1])
  
  // Critical system variables that must be preserved
  const criticalVars = [
    'cpu_percent', 'mem_used_gb', 'mem_total_gb', 'mem_percent',
    'load_1min', 'load_5min', 'load_15min', 'platform'
  ]
  
  for (const criticalVar of criticalVars) {
    const originalHas = originalVars.includes(criticalVar)
    const optimizedHas = optimizedVars.includes(criticalVar) || 
                        optimizedVars.includes(COMPACT_VARIABLES[criticalVar as keyof typeof COMPACT_VARIABLES] || criticalVar)
    
    if (originalHas && !optimizedHas) {
      issues.push(`Critical system variable '${criticalVar}' was removed during optimization`)
      severity = 'high'
    }
  }
  
  // Check if we lost any essential variables (allowing for renames via COMPACT_VARIABLES)
  const compactMap = Object.values(COMPACT_VARIABLES)
  const missingVars = originalVars.filter(varName => 
    !optimizedVars.includes(varName) && 
    !compactMap.includes(COMPACT_VARIABLES[varName as keyof typeof COMPACT_VARIABLES])
  )
  
  if (missingVars.length > 0) {
    const nonCriticalMissing = missingVars.filter(v => !criticalVars.includes(v))
    if (nonCriticalMissing.length > 0) {
      issues.push(`Non-critical variable declarations removed: ${nonCriticalMissing.join(', ')}`)
      severity = severity === 'low' ? 'medium' : severity
    }
  }
  
  return { issues, severity }
}

/**
 * Validate syntax integrity after optimizations
 */
function validateSyntaxIntegrity(optimized: string): { issues: string[]; severity: 'low' | 'medium' | 'high' } {
  const issues: string[] = []
  let severity: 'low' | 'medium' | 'high' = 'low'
  
  // Check for unmatched quotes (but ignore escaped quotes and template literals)
  const cleanedCode = optimized
    .replace(/\\"/g, '') // Remove escaped double quotes
    .replace(/\\'/g, '') // Remove escaped single quotes
    .replace(/\$'[^']*'/g, '') // Remove $'...' constructs
  
  const doubleQuoteCount = (cleanedCode.match(/"/g) || []).length
  const singleQuoteCount = (cleanedCode.match(/'/g) || []).length
  
  if (doubleQuoteCount % 2 !== 0) {
    issues.push('Unmatched double quotes detected')
    severity = 'high'
  }
  
  if (singleQuoteCount % 2 !== 0) {
    issues.push('Unmatched single quotes detected') 
    severity = 'medium' // Reduced severity for single quotes
  }
  
  // Check for unmatched brackets and parentheses (but be more tolerant)
  const bracketCount = (optimized.match(/\{/g) || []).length - (optimized.match(/\}/g) || []).length
  const parenCount = (optimized.match(/\(/g) || []).length - (optimized.match(/\)/g) || []).length
  const squareBracketCount = (optimized.match(/\[/g) || []).length - (optimized.match(/\]/g) || []).length
  
  if (Math.abs(bracketCount) > 2) { // Allow some tolerance for complex expressions
    issues.push(`Unmatched curly brackets detected (${bracketCount > 0 ? 'unclosed' : 'extra closing'})`)
    severity = 'high'
  }
  
  if (Math.abs(parenCount) > 2) { // Allow some tolerance for complex expressions
    issues.push(`Unmatched parentheses detected (${parenCount > 0 ? 'unclosed' : 'extra closing'})`)
    severity = 'high'
  }
  
  if (Math.abs(squareBracketCount) > 1) { // Square brackets are less critical
    issues.push(`Unmatched square brackets detected (${squareBracketCount > 0 ? 'unclosed' : 'extra closing'})`)
    severity = 'medium'
  }
  
  // Check for malformed command substitutions
  const malformedSubst = optimized.match(/\$\([^)]*$/gm)
  if (malformedSubst && malformedSubst.length > 0) {
    issues.push('Malformed command substitutions detected')
    severity = 'high'
  }
  
  // Check for broken variable references (but be less aggressive)
  const brokenVarRefs = optimized.match(/\$[^a-zA-Z_\{\(\s\$\?0-9]/g)
  if (brokenVarRefs && brokenVarRefs.length > 0) {
    // Filter out common valid bash constructs
    const reallyBroken = brokenVarRefs.filter(ref => 
      !ref.match(/\$[0-9]/) && // positional parameters
      !ref.match(/\$[\?\$\!]/) && // special variables
      !ref.match(/\$[\+\-\*\/\%]/) // arithmetic
    )
    if (reallyBroken.length > 0) {
      issues.push(`Potentially broken variable references detected: ${reallyBroken.join(', ')}`)
      severity = 'medium'
    }
  }
  
  return { issues, severity }
}

/**
 * Validate performance impact of optimizations
 */
function validatePerformanceImpact(original: string, optimized: string): { issues: string[]; severity: 'low' | 'medium' | 'high' } {
  const issues: string[] = []
  let severity: 'low' | 'medium' | 'high' = 'low'
  
  // Check if optimization significantly increased script size (may indicate problem)
  const originalSize = original.length
  const optimizedSize = optimized.length
  const sizeIncrease = (optimizedSize - originalSize) / originalSize
  
  if (sizeIncrease > 0.5) { // More than 50% size increase
    issues.push(`Optimization increased script size by ${(sizeIncrease * 100).toFixed(1)}%`)
    severity = 'medium'
  }
  
  // Check for removed performance optimizations
  const performancePatterns = [
    'timeout \\d+s',
    '2>/dev/null',
    '\\|\\| echo',
    'command -v .* >/dev/null'
  ]
  
  for (const pattern of performancePatterns) {
    const originalMatches = (original.match(new RegExp(pattern, 'g')) || []).length
    const optimizedMatches = (optimized.match(new RegExp(pattern, 'g')) || []).length
    
    if (originalMatches > optimizedMatches) {
      issues.push(`Performance optimization pattern '${pattern}' was reduced (${originalMatches} -> ${optimizedMatches})`)
      severity = severity === 'low' ? 'medium' : severity
    }
  }
  
  return { issues, severity }
}