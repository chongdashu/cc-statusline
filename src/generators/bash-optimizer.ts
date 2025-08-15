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
 * Apply all micro-optimizations to bash code
 */
export function optimizeBashCode(bashCode: string, options: OptimizationOptions = {}): string {
  const defaultOptions: OptimizationOptions = {
    compactVariables: true,
    useBuiltins: true,
    reduceSubshells: true,
    combinePipes: true,
    ...options
  }
  
  let optimized = bashCode
  
  // Apply optimizations in order
  optimized = applyCompactVariables(optimized, defaultOptions)
  optimized = applyBuiltinReplacements(optimized, defaultOptions)
  optimized = reduceSubshells(optimized, defaultOptions)
  optimized = combinePipeOperations(optimized, defaultOptions)
  
  return optimized
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
 * Validate that optimizations don't break functionality
 */
export function validateOptimizations(original: string, optimized: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = []
  
  // Check for common optimization mistakes
  
  // Ensure variable references are still valid
  const originalVars = Array.from(original.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g))
    .map(match => match[1])
  const optimizedVars = Array.from(optimized.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g))
    .map(match => match[1])
  
  // Check if we lost any essential variables (allowing for renames via COMPACT_VARIABLES)
  const compactMap = Object.values(COMPACT_VARIABLES)
  const missingVars = originalVars.filter(varName => 
    !optimizedVars.includes(varName) && 
    !compactMap.includes(COMPACT_VARIABLES[varName as keyof typeof COMPACT_VARIABLES])
  )
  
  if (missingVars.length > 0) {
    issues.push(`Missing variable declarations: ${missingVars.join(', ')}`)
  }
  
  // Check for unmatched quotes or brackets (basic syntax check)
  const quoteCount = (optimized.match(/"/g) || []).length
  if (quoteCount % 2 !== 0) {
    issues.push('Unmatched quotes detected')
  }
  
  const bracketCount = (optimized.match(/\{/g) || []).length - (optimized.match(/\}/g) || []).length
  if (bracketCount !== 0) {
    issues.push('Unmatched brackets detected')
  }
  
  return {
    isValid: issues.length === 0,
    issues
  }
}