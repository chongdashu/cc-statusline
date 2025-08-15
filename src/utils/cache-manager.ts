import { createHash } from 'crypto'

export interface CacheKey {
  type: 'ccusage' | 'git' | 'system' | 'template' | 'template_fragment' | 'template_combination'
  context: string  // pwd hash for git, features hash for template
  timestamp: number
}

export interface CacheEntry<T = any> {
  key: CacheKey
  value: T
  expiry: number
  hits: number
}

export interface CacheConfig {
  memoryTTL: number     // Memory cache TTL in milliseconds (default: 5000)
  fileTTL: number       // File cache TTL in seconds (default: 30-300)
  maxMemoryEntries: number  // Max entries in memory cache (default: 100)
  templateFragmentTTL: number // Template fragment cache TTL (default: 300000 = 5 minutes)
  templateCombinationTTL: number // Template combination cache TTL (default: 60000 = 1 minute)
}

export interface OptimizationMetrics {
  scriptSize: number
  generationTime: number
  executionTime: number
  cacheHitRate: number
  featureComplexity: number
}

/**
 * Multi-level cache manager
 * Provides memory cache (Node.js) + file cache (bash) + process cache (script variables)
 */
export class CacheManager {
  private memoryCache = new Map<string, CacheEntry>()
  private config: CacheConfig
  private metrics: OptimizationMetrics

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      memoryTTL: 5000,        // 5 seconds memory cache
      fileTTL: 30,            // 30 seconds file cache (matches current usage.ts)
      maxMemoryEntries: 100,
      templateFragmentTTL: 300000,    // 5 minutes for template fragments (rarely change)
      templateCombinationTTL: 60000,  // 1 minute for template combinations
      ...config
    }
    
    this.metrics = {
      scriptSize: 0,
      generationTime: 0,
      executionTime: 0,
      cacheHitRate: 0,
      featureComplexity: 0
    }
  }

  /**
   * Generate optimized cache key for given context
   */
  generateCacheKey(type: CacheKey['type'], context: string): string {
    const contextHash = createHash('md5').update(context).digest('hex').substring(0, 8)
    return `${type}_${contextHash}`
  }

  /**
   * Get from memory cache with TTL check
   */
  getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key)
    if (!entry || Date.now() > entry.expiry) {
      this.memoryCache.delete(key)
      return null
    }
    entry.hits++
    return entry.value
  }

  /**
   * Set memory cache entry with TTL
   */
  setInMemory<T>(key: string, value: T, type: CacheKey['type'], context: string): void {
    // Cleanup if at capacity
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      this.cleanupMemoryCache()
    }

    // Use different TTL based on cache type
    let ttl = this.config.memoryTTL
    if (type === 'template_fragment') {
      ttl = this.config.templateFragmentTTL
    } else if (type === 'template_combination') {
      ttl = this.config.templateCombinationTTL
    }

    const cacheEntry: CacheEntry<T> = {
      key: { type, context, timestamp: Date.now() },
      value,
      expiry: Date.now() + ttl,
      hits: 0
    }
    
    this.memoryCache.set(key, cacheEntry)
  }

  /**
   * Generate bash code for file-level caching with reliability improvements (Phase 4)
   */
  generateFileCacheCode(type: 'ccusage' | 'git' | 'system', command: string): string {
    const cacheFile = type === 'ccusage' 
      ? '${HOME}/.claude/ccusage_cache.json'
      : type === 'system'
      ? '${HOME}/.claude/system_cache_${PWD//\\//_}.tmp'
      : '${HOME}/.claude/git_cache_${PWD//\\//_}.tmp'
    
    const ttl = type === 'ccusage' ? 30 : type === 'system' ? 15 : 10  // Different TTLs per cache type
    
    return `
# ${type} cache with reliability improvements (${ttl}s TTL)
cache_file="${cacheFile}"
cache_ttl=${ttl}
use_cache=0
cache_valid=0

# Phase 4: Enhanced cache validation and corruption detection
validate_cache_integrity() {
  local file="\$1"
  local cache_type="\$2"
  
  # Basic file checks
  if [[ ! -f "\$file" ]]; then
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Cache file does not exist: \$file" >&2
    return 1
  fi
  
  # Size check - cache files should not be empty or suspiciously large
  local file_size=\$(stat -c %s "\$file" 2>/dev/null || stat -f %z "\$file" 2>/dev/null || echo 0)
  if (( file_size == 0 )); then
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Cache file is empty: \$file" >&2
    return 1
  elif (( file_size > 100000 )); then
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Cache file suspiciously large (\${file_size} bytes): \$file" >&2
    return 1
  fi
  
  # Content validation based on cache type
  case "\$cache_type" in
    ccusage)
      # Validate JSON structure for ccusage cache
      if command -v jq >/dev/null 2>&1; then
        if ! jq empty "\$file" 2>/dev/null; then
          [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Invalid JSON in ccusage cache: \$file" >&2
          return 1
        fi
      else
        # Fallback validation - check for basic JSON structure
        if ! grep -q "^{.*}$" "\$file" 2>/dev/null; then
          [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] ccusage cache doesn't look like JSON: \$file" >&2
          return 1
        fi
      fi
      ;;
    git|system)
      # Validate key=value format for git/system cache
      if ! grep -q "=" "\$file" 2>/dev/null; then
        [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] \$cache_type cache missing key=value pairs: \$file" >&2
        return 1
      fi
      
      # Check for shell injection attempts (basic security)
      if grep -q "\\\$(\\|\\;&\\|\\|&\\||\\||)" "\$file" 2>/dev/null; then
        [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Potential shell injection in cache: \$file" >&2
        return 1
      fi
      ;;
  esac
  
  return 0
}

repair_cache_file() {
  local file="\$1"
  local cache_type="\$2"
  
  [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Attempting to repair cache file: \$file" >&2
  
  # Create backup of corrupted cache
  if [[ -f "\$file" ]]; then
    cp "\$file" "\${file}.corrupted.\$(date +%s)" 2>/dev/null
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Backed up corrupted cache to \${file}.corrupted.*" >&2
  fi
  
  # Remove corrupted cache to force fresh generation
  rm -f "\$file" 2>/dev/null
  
  return 0
}

if [[ -f "\$cache_file" ]]; then
  cache_age=\$((\${EPOCHSECONDS:-\$(date +%s)} - \$(stat -c %Y "\$cache_file" 2>/dev/null || stat -f %m "\$cache_file" 2>/dev/null || echo 0)))
  
  if (( cache_age < cache_ttl )); then
    # Validate cache integrity before using
    if validate_cache_integrity "\$cache_file" "${type}"; then
      use_cache=1
      cache_valid=1
      cached_result=\$(cat "\$cache_file" 2>/dev/null)
      [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Using valid ${type} cache (age: \${cache_age}s)" >&2
    else
      [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Cache integrity check failed for ${type} cache" >&2
      repair_cache_file "\$cache_file" "${type}"
    fi
  else
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] ${type} cache expired (age: \${cache_age}s, TTL: ${ttl}s)" >&2
    # Clean up expired cache
    rm -f "\$cache_file" 2>/dev/null
  fi
fi

if [[ \$use_cache -eq 0 ]]; then
  # Execute command and cache result with error handling
  [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Generating fresh ${type} data" >&2
  
  # Execute command with timeout protection
  if command -v timeout >/dev/null 2>&1; then
    fresh_result=\$(timeout 10s ${command} 2>/dev/null)
    cmd_exit_code=\$?
  else
    fresh_result=\$(${command} 2>/dev/null)
    cmd_exit_code=\$?
  fi
  
  # Validate command output before caching
  if [[ \$cmd_exit_code -eq 0 ]] && [[ -n "\$fresh_result" ]]; then
    # Additional validation for specific cache types
    case "${type}" in
      ccusage)
        if [[ "\$fresh_result" =~ ^\\{.*\\}$ ]]; then
          # Write to cache with atomic operation (write to temp file, then move)
          mkdir -p "\$(dirname "\$cache_file")" 2>/dev/null
          temp_cache="\${cache_file}.tmp.\$\$"
          if echo "\$fresh_result" > "\$temp_cache" 2>/dev/null; then
            mv "\$temp_cache" "\$cache_file" 2>/dev/null
            cached_result="\$fresh_result"
            [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Cached fresh ccusage data" >&2
          else
            rm -f "\$temp_cache" 2>/dev/null
          fi
        else
          [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] ccusage output doesn't look like JSON, not caching" >&2
          cached_result="\$fresh_result"
        fi
        ;;
      git|system)
        if [[ "\$fresh_result" =~ = ]]; then
          # Write to cache with atomic operation
          mkdir -p "\$(dirname "\$cache_file")" 2>/dev/null
          temp_cache="\${cache_file}.tmp.\$\$"
          if echo "\$fresh_result" > "\$temp_cache" 2>/dev/null; then
            mv "\$temp_cache" "\$cache_file" 2>/dev/null
            cached_result="\$fresh_result"
            [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Cached fresh ${type} data" >&2
          else
            rm -f "\$temp_cache" 2>/dev/null
          fi
        else
          [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] ${type} output doesn't contain key=value pairs, not caching" >&2
          cached_result="\$fresh_result"
        fi
        ;;
    esac
  else
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Command failed or returned empty result for ${type}" >&2
    cached_result=""
  fi
fi`
  }

  /**
   * Generate bash code for process-level caching (within script execution)
   */
  generateProcessCacheCode(variableName: string, computation: string): string {
    return `
# Process cache for ${variableName}
if [ -z "\$${variableName}" ]; then
  ${variableName}=$(${computation})
fi`
  }

  /**
   * Context-aware cache invalidation
   */
  invalidateCache(type: CacheKey['type'], context?: string): void {
    if (context) {
      const key = this.generateCacheKey(type, context)
      this.memoryCache.delete(key)
    } else {
      // Invalidate all entries of this type
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.key.type === type) {
          this.memoryCache.delete(key)
        }
      }
    }
  }

  /**
   * Generate bash code for cache directory initialization with enhanced reliability (Phase 4)
   */
  generateCacheInitCode(): string {
    return `
# Initialize cache directory with enhanced reliability
init_cache_directory() {
  local cache_dir="\${HOME}/.claude"
  
  # Create cache directory with proper permissions
  if ! mkdir -p "\$cache_dir" 2>/dev/null; then
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Failed to create cache directory: \$cache_dir" >&2
    return 1
  fi
  
  # Verify directory is writable
  if ! touch "\$cache_dir/.write_test" 2>/dev/null; then
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Cache directory not writable: \$cache_dir" >&2
    return 1
  else
    rm -f "\$cache_dir/.write_test" 2>/dev/null
  fi
  
  # Check disk space (warn if less than 10MB available)
  if command -v df >/dev/null 2>&1; then
    local available_kb=\$(df "\$cache_dir" 2>/dev/null | awk 'NR==2 {print \$4}' 2>/dev/null || echo "999999")
    if (( available_kb < 10240 )); then  # Less than 10MB
      [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Low disk space for cache: \${available_kb}KB available" >&2
    fi
  fi
  
  return 0
}

# Enhanced cache cleanup with corruption detection and repair
cleanup_cache_files() {
  local cache_dir="\${HOME}/.claude"
  [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Running cache cleanup" >&2
  
  if [[ ! -d "\$cache_dir" ]]; then
    return 0
  fi
  
  # Clean up old cache files
  if command -v find >/dev/null 2>&1; then
    # Remove cache files older than 2 hours
    find "\$cache_dir" -name "*_cache_*.tmp" -mmin +120 -delete 2>/dev/null
    find "\$cache_dir" -name "ccusage_cache.json" -mmin +180 -delete 2>/dev/null
    find "\$cache_dir" -name "system_cache_*.tmp" -mmin +60 -delete 2>/dev/null
    
    # Clean up corruption backups older than 24 hours
    find "\$cache_dir" -name "*.corrupted.*" -mmin +1440 -delete 2>/dev/null
    
    # Clean up temp files from interrupted operations
    find "\$cache_dir" -name "*.tmp.*" -mmin +10 -delete 2>/dev/null
    
    [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Cache cleanup completed" >&2
  fi
  
  # Validate remaining cache files for corruption
  local cache_files=("\$cache_dir"/*.json "\$cache_dir"/*.tmp)
  for cache_file in "\${cache_files[@]}"; do
    if [[ -f "\$cache_file" ]] && [[ "\$cache_file" != *"corrupted"* ]]; then
      # Determine cache type from filename
      local cache_type="git"
      if [[ "\$cache_file" == *"ccusage"* ]]; then
        cache_type="ccusage"
      elif [[ "\$cache_file" == *"system"* ]]; then
        cache_type="system"
      fi
      
      # Validate integrity and remove if corrupted
      if ! validate_cache_integrity "\$cache_file" "\$cache_type" 2>/dev/null; then
        [[ \$CC_STATUSLINE_DEBUG ]] && echo "[DEBUG] Removing corrupted cache file: \$cache_file" >&2
        repair_cache_file "\$cache_file" "\$cache_type"
      fi
    fi
  done
}

# Initialize cache directory
init_cache_directory

# Run cleanup occasionally (1% chance each time, or when debug is enabled)
if [[ \$CC_STATUSLINE_DEBUG ]] || [[ "\$((\$(date +%s) % 100))" -eq 0 ]]; then
  cleanup_cache_files
fi`
  }

  /**
   * Memory cache cleanup - remove expired entries
   */
  private cleanupMemoryCache(): void {
    const now = Date.now()
    const toDelete: string[] = []
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiry) {
        toDelete.push(key)
      }
    }
    
    // If still at capacity, remove least recently used entries
    if (toDelete.length === 0 && this.memoryCache.size >= this.config.maxMemoryEntries) {
      const sorted = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].hits - b[1].hits)
      
      toDelete.push(...sorted.slice(0, Math.floor(this.config.maxMemoryEntries * 0.2)).map(([key]) => key))
    }
    
    toDelete.forEach(key => this.memoryCache.delete(key))
  }

  /**
   * Get cache hit rate for performance monitoring
   */
  getCacheHitRate(): number {
    if (this.memoryCache.size === 0) return 0
    
    const totalHits = Array.from(this.memoryCache.values()).reduce((sum, entry) => sum + entry.hits, 0)
    const totalEntries = this.memoryCache.size
    
    return totalHits / totalEntries
  }

  /**
   * Get current metrics for performance monitoring
   */
  getMetrics(): OptimizationMetrics {
    return {
      ...this.metrics,
      cacheHitRate: this.getCacheHitRate()
    }
  }

  /**
   * Update metrics (called by generators and features)
   */
  updateMetrics(updates: Partial<OptimizationMetrics>): void {
    this.metrics = { ...this.metrics, ...updates }
  }

  /**
   * Get template-specific cache statistics for monitoring
   */
  getTemplateCacheStats() {
    const fragmentEntries = Array.from(this.memoryCache.values()).filter(entry => entry.key.type === 'template_fragment')
    const combinationEntries = Array.from(this.memoryCache.values()).filter(entry => entry.key.type === 'template_combination')
    const templateEntries = Array.from(this.memoryCache.values()).filter(entry => entry.key.type === 'template')
    
    return {
      fragmentCount: fragmentEntries.length,
      combinationCount: combinationEntries.length,
      templateCount: templateEntries.length,
      fragmentHits: fragmentEntries.reduce((sum, entry) => sum + entry.hits, 0),
      combinationHits: combinationEntries.reduce((sum, entry) => sum + entry.hits, 0),
      templateHits: templateEntries.reduce((sum, entry) => sum + entry.hits, 0),
      totalTemplateRelatedEntries: fragmentEntries.length + combinationEntries.length + templateEntries.length
    }
  }

  /**
   * Invalidate template-related caches (useful when updating template system)
   */
  invalidateTemplateCaches(): void {
    const toDelete: string[] = []
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.key.type.startsWith('template')) {
        toDelete.push(key)
      }
    }
    
    toDelete.forEach(key => this.memoryCache.delete(key))
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager()

/**
 * Utility functions for cache key generation
 */
export function generateContextHash(...inputs: string[]): string {
  return createHash('md5').update(inputs.join('|')).digest('hex').substring(0, 8)
}

export function generateFeatureHash(features: string[], config: any): string {
  const configString = JSON.stringify({ features, ...config }, null, 0)
  return createHash('md5').update(configString).digest('hex').substring(0, 8)
}