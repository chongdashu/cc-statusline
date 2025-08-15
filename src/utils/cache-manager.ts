import { createHash } from 'crypto'

export interface CacheKey {
  type: 'ccusage' | 'git' | 'template' | 'template_fragment' | 'template_combination'
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
   * Generate bash code for file-level caching (integrates with current patterns)
   */
  generateFileCacheCode(type: 'ccusage' | 'git', command: string): string {
    const cacheFile = type === 'ccusage' 
      ? '${HOME}/.claude/ccusage_cache.json'
      : '${HOME}/.claude/git_cache_${PWD//\\//_}.tmp'
    
    const ttl = type === 'ccusage' ? 30 : 10  // Different TTLs per cache type
    
    return `
# ${type} cache (${ttl}s TTL)
cache_file="${cacheFile}"
cache_ttl=${ttl}
use_cache=0

if [ -f "$cache_file" ]; then
  cache_age=$(($(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || stat -f %m "$cache_file" 2>/dev/null || echo 0)))
  if [ $cache_age -lt $cache_ttl ]; then
    use_cache=1
    cached_result=$(cat "$cache_file" 2>/dev/null)
  fi
fi

if [ $use_cache -eq 0 ]; then
  # Execute command and cache result
  fresh_result=$(${command})
  if [ -n "$fresh_result" ]; then
    mkdir -p "$(dirname "$cache_file")" 2>/dev/null
    echo "$fresh_result" > "$cache_file" 2>/dev/null
    cached_result="$fresh_result"
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
   * Generate bash code for cache directory initialization
   */
  generateCacheInitCode(): string {
    return `
# Initialize cache directory
mkdir -p "\${HOME}/.claude" 2>/dev/null

# Cleanup old cache files (run occasionally to prevent accumulation)
if [ "\$((\$(date +%s) % 100))" -eq 0 ]; then
  cleanup_cache() {
    if [ -d "\${HOME}/.claude" ]; then
      find "\${HOME}/.claude" -name "*_cache_*.tmp" -mmin +60 -delete 2>/dev/null
      find "\${HOME}/.claude" -name "ccusage_cache.json" -mmin +120 -delete 2>/dev/null
    fi
  }
  cleanup_cache
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