import { StatuslineConfig } from '../cli/prompts.js'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

export interface TestResult {
  success: boolean
  output: string
  error?: string
  executionTime: number
}

export async function testStatuslineScript(script: string, mockData?: any): Promise<TestResult> {
  const startTime = Date.now()
  
  try {
    // Create temporary script file
    const tempDir = '/tmp'
    const scriptPath = path.join(tempDir, `statusline-test-${Date.now()}.sh`)
    
    await fs.writeFile(scriptPath, script, { mode: 0o755 })
    
    // Generate mock input if not provided
    const input = mockData || generateMockClaudeInput()
    
    // Execute script
    const result = await executeScript(scriptPath, JSON.stringify(input))
    
    // Cleanup
    await fs.unlink(scriptPath).catch(() => {}) // Ignore cleanup errors
    
    const executionTime = Date.now() - startTime
    
    return {
      success: result.success,
      output: result.output,
      ...(result.error && { error: result.error }),
      executionTime
    }
    
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime
    }
  }
}

export function generateMockClaudeInput(_config?: Partial<StatuslineConfig>): any {
  return {
    session_id: "test-session-123",
    transcript_path: "/home/user/.claude/conversations/test.jsonl",
    cwd: "/home/user/projects/my-project",
    workspace: {
      current_dir: "/home/user/projects/my-project"
    },
    model: {
      id: "claude-opus-4-1-20250805",
      display_name: "Opus 4.1",
      version: "20250805"
    }
  }
}

export function generateMockCcusageOutput(): any {
  return {
    blocks: [
      {
        id: "2025-08-13T08:00:00.000Z",
        startTime: "2025-08-13T08:00:00.000Z",
        endTime: "2025-08-13T13:00:00.000Z",
        usageLimitResetTime: "2025-08-13T13:00:00.000Z",
        actualEndTime: "2025-08-13T09:30:34.698Z",
        isActive: true,
        isGap: false,
        entries: 12,
        tokenCounts: {
          inputTokens: 1250,
          outputTokens: 2830,
          cacheCreationInputTokens: 15000,
          cacheReadInputTokens: 45000
        },
        totalTokens: 64080,
        costUSD: 3.42,
        models: ["claude-opus-4-1-20250805"],
        burnRate: {
          tokensPerMinute: 850.5,
          tokensPerMinuteForIndicator: 850,
          costPerHour: 12.45
        },
        projection: {
          totalTokens: 128000,
          totalCost: 6.84,
          remainingMinutes: 210
        }
      }
    ]
  }
}

export function generateMockSystemData(platform?: 'Linux' | 'WSL' | 'Darwin' | 'Windows', scenario?: 'low' | 'normal' | 'high' | 'trending_up' | 'trending_down' | 'stress' | 'edge_case' | 'invalid_data'): any {
  let baseData: any
  
  // Generate different scenarios to test Phase 3 features
  switch (scenario) {
    case 'low':
      // Low resource usage - should show green status indicators
      baseData = {
        cpu_percent: 15,
        memory_used_gb: 2,
        memory_total_gb: 16,
        memory_percent: 12.5,
        load_1min: 0.25,
        load_5min: 0.30,
        load_15min: 0.35,
      }
      break
    case 'high':
      // High resource usage - should show red status indicators  
      baseData = {
        cpu_percent: 85,
        memory_used_gb: 14,
        memory_total_gb: 16,
        memory_percent: 87.5,
        load_1min: 3.5,
        load_5min: 3.2,
        load_15min: 2.8,
      }
      break
    case 'trending_up':
      // Load increasing trend - should show ↗ indicator
      baseData = {
        cpu_percent: 55,
        memory_used_gb: 8,
        memory_total_gb: 16,
        memory_percent: 50.0,
        load_1min: 2.1,
        load_5min: 1.5,
        load_15min: 1.2,
      }
      break
    case 'trending_down':
      // Load decreasing trend - should show ↘ indicator
      baseData = {
        cpu_percent: 35,
        memory_used_gb: 6,
        memory_total_gb: 16,
        memory_percent: 37.5,
        load_1min: 0.8,
        load_5min: 1.3,
        load_15min: 1.8,
      }
      break
    case 'stress':
      // Extreme stress test scenario - maximum reasonable values
      baseData = {
        cpu_percent: 99,
        memory_used_gb: 63,
        memory_total_gb: 64,
        memory_percent: 98.4,
        load_1min: 15.75,
        load_5min: 14.20,
        load_15min: 12.80,
        cpu_cores: 16
      }
      break
    case 'edge_case':
      // Edge case scenario - boundary values and unusual conditions
      baseData = {
        cpu_percent: 0,
        memory_used_gb: 0,
        memory_total_gb: 1,
        memory_percent: 0,
        load_1min: 0.00,
        load_5min: 0.00,
        load_15min: 0.00,
        // Test very small memory system
        memory_total_mb: 512,
        memory_used_mb: 0
      }
      break
    case 'invalid_data':
      // Invalid/corrupted data scenario - tests validation framework
      baseData = {
        cpu_percent: -5, // Invalid negative CPU
        memory_used_gb: 200, // Used > total (impossible)
        memory_total_gb: 16,
        memory_percent: 1250, // Invalid percentage > 100
        load_1min: -1.5, // Invalid negative load
        load_5min: "invalid", // Non-numeric string
        load_15min: 999.99, // Extremely high load
        // Missing critical fields to test fallbacks
        platform: "UnknownOS"
      }
      break
    default:
      // Normal scenario
      baseData = {
        cpu_percent: 45.2,
        memory_used_gb: 8,
        memory_total_gb: 16,
        memory_percent: 50.0,
        load_1min: 1.25,
        load_5min: 1.15,
        load_15min: 0.98,
      }
  }
  
  baseData.platform = platform || "Linux"

  // Platform-specific variations
  switch (platform) {
    case 'WSL':
      return {
        ...baseData,
        platform: 'WSL',
        wsl_version: '2',
        // WSL typically shows different CPU characteristics
        cpu_percent: 32.5,
        memory_used_gb: 6,
        memory_total_gb: 12,
        memory_percent: 50.0,
        // WSL load averages tend to be lower due to Windows integration
        load_1min: 0.85,
        load_5min: 0.92,
        load_15min: 1.05,
        // Additional WSL-specific metrics
        cpu_cores: 8,
        memory_available_gb: 6
      }
    
    case 'Darwin':
      return {
        ...baseData,
        platform: 'Darwin',
        // macOS typically has different memory patterns
        cpu_percent: 28.7,
        memory_used_gb: 12,
        memory_total_gb: 32,
        memory_percent: 37.5,
        load_1min: 2.15,
        load_5min: 2.05,
        load_15min: 1.95,
        // macOS-specific
        page_size: 4096,
        memory_pressure: 'normal'
      }
    
    case 'Windows':
      return {
        ...baseData,
        platform: 'Windows',
        cpu_percent: 55.0,
        memory_used_gb: 10,
        memory_total_gb: 24,
        memory_percent: 41.7,
        // Windows doesn't have traditional load averages
        load_1min: 0,
        load_5min: 0,
        load_15min: 0
      }
    
    default:
      return baseData
  }
}

export function generateMockWSLSystemData(): any {
  return generateMockSystemData('WSL')
}

export function generateMockMacOSSystemData(): any {
  return generateMockSystemData('Darwin')
}

/**
 * Phase 4 Reliability Testing: Comprehensive stress testing suite
 */
export interface StressTestConfig {
  platforms: Array<'Linux' | 'WSL' | 'Darwin' | 'Windows'>
  scenarios: Array<'low' | 'normal' | 'high' | 'trending_up' | 'trending_down' | 'stress' | 'edge_case' | 'invalid_data'>
  includeCorruptedData: boolean
  includeMissingTools: boolean
  includePermissionErrors: boolean
  timeoutScenarios: boolean
}

export async function runStressTests(script: string, config: StressTestConfig): Promise<StressTestResults> {
  const results: StressTestResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    testResults: [],
    performanceStats: {
      averageExecutionTime: 0,
      maxExecutionTime: 0,
      minExecutionTime: Infinity,
      timeouts: 0
    },
    reliabilityStats: {
      validationErrorsHandled: 0,
      gracefulDegradations: 0,
      completeFailures: 0
    }
  }

  const allTests: Array<{ platform: string, scenario: string, mockData: any }> = []

  // Generate all test combinations
  for (const platform of config.platforms) {
    for (const scenario of config.scenarios) {
      allTests.push({
        platform,
        scenario,
        mockData: generateMockSystemData(platform, scenario)
      })
    }
  }

  // Add corrupted data tests
  if (config.includeCorruptedData) {
    allTests.push(
      { platform: 'Linux', scenario: 'corrupted_json', mockData: generateCorruptedInputData() },
      { platform: 'WSL', scenario: 'malformed_data', mockData: generateMalformedSystemData() },
      { platform: 'Darwin', scenario: 'empty_data', mockData: {} }
    )
  }

  // Add missing tools simulation
  if (config.includeMissingTools) {
    allTests.push(
      { platform: 'Linux', scenario: 'no_vmstat', mockData: generateMockSystemData('Linux', 'normal') },
      { platform: 'Darwin', scenario: 'no_sysctl', mockData: generateMockSystemData('Darwin', 'normal') }
    )
  }

  results.totalTests = allTests.length

  // Execute all tests
  for (const test of allTests) {
    try {
      let testScript = script
      
      // Simulate missing tools by modifying script
      if (test.scenario.includes('no_')) {
        testScript = simulateMissingTools(script, test.scenario)
      }

      const testResult = await testStatuslineScript(testScript, test.mockData)
      
      // Analyze result
      const analysis = analyzeStressTestResult(testResult, test.platform, test.scenario)
      
      results.testResults.push({
        platform: test.platform,
        scenario: test.scenario,
        result: testResult,
        analysis
      })

      // Update stats
      if (analysis.passed) {
        results.passed++
      } else {
        results.failed++
      }

      if (analysis.hasWarnings) {
        results.warnings++
      }

      // Performance stats
      results.performanceStats.averageExecutionTime += testResult.executionTime
      results.performanceStats.maxExecutionTime = Math.max(results.performanceStats.maxExecutionTime, testResult.executionTime)
      results.performanceStats.minExecutionTime = Math.min(results.performanceStats.minExecutionTime, testResult.executionTime)

      if (testResult.executionTime > 5000) {
        results.performanceStats.timeouts++
      }

      // Reliability stats
      if (analysis.validationErrorHandled) {
        results.reliabilityStats.validationErrorsHandled++
      }
      if (analysis.gracefulDegradation) {
        results.reliabilityStats.gracefulDegradations++
      }
      if (!testResult.success && !analysis.gracefulDegradation) {
        results.reliabilityStats.completeFailures++
      }

    } catch (error) {
      results.failed++
      results.reliabilityStats.completeFailures++
      results.testResults.push({
        platform: test.platform,
        scenario: test.scenario,
        result: {
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          executionTime: 0
        },
        analysis: {
          passed: false,
          hasWarnings: true,
          validationErrorHandled: false,
          gracefulDegradation: false,
          issues: [`Test execution failed: ${error instanceof Error ? error.message : String(error)}`]
        }
      })
    }
  }

  // Finalize performance stats
  results.performanceStats.averageExecutionTime /= results.totalTests

  return results
}

export interface StressTestResults {
  totalTests: number
  passed: number
  failed: number
  warnings: number
  testResults: Array<{
    platform: string
    scenario: string
    result: TestResult
    analysis: StressTestAnalysis
  }>
  performanceStats: {
    averageExecutionTime: number
    maxExecutionTime: number
    minExecutionTime: number
    timeouts: number
  }
  reliabilityStats: {
    validationErrorsHandled: number
    gracefulDegradations: number
    completeFailures: number
  }
}

export interface StressTestAnalysis {
  passed: boolean
  hasWarnings: boolean
  validationErrorHandled: boolean
  gracefulDegradation: boolean
  issues: string[]
}

function analyzeStressTestResult(result: TestResult, platform: string, scenario: string): StressTestAnalysis {
  const analysis: StressTestAnalysis = {
    passed: result.success,
    hasWarnings: false,
    validationErrorHandled: false,
    gracefulDegradation: false,
    issues: []
  }

  // Check for validation error handling
  if (scenario === 'invalid_data') {
    if (result.success && !result.output.includes('error')) {
      analysis.validationErrorHandled = true
    } else if (result.success) {
      analysis.gracefulDegradation = true
      analysis.hasWarnings = true
      analysis.issues.push('Invalid data scenario should handle validation gracefully')
    }
  }

  // Check for stress test handling
  if (scenario === 'stress') {
    if (result.executionTime > 1000) {
      analysis.hasWarnings = true
      analysis.issues.push(`Stress test execution time too high: ${result.executionTime}ms`)
    }
    if (result.success && result.output.includes('99%')) {
      analysis.passed = true
    }
  }

  // Check for edge case handling
  if (scenario === 'edge_case') {
    if (result.success && (result.output.includes('0%') || result.output.includes('0G'))) {
      analysis.gracefulDegradation = true
    }
  }

  // Platform-specific checks
  if (platform === 'WSL' && result.output.includes('WSL')) {
    analysis.passed = true
  }

  // Check for timeout handling
  if (result.executionTime > 5000) {
    analysis.hasWarnings = true
    analysis.issues.push('Test execution timed out or took too long')
  }

  // Check error handling
  if (result.error && result.error.includes('validation')) {
    analysis.validationErrorHandled = true
  }

  return analysis
}

function generateCorruptedInputData(): any {
  return {
    "invalid": "json",
    "nested": {
      "broken": null,
      "array": [1, "mixed", { "types": true }]
    },
    "circular_ref": null // Simulates circular reference issue
  }
}

function generateMalformedSystemData(): any {
  return {
    cpu_percent: "not_a_number",
    memory_used_gb: {},
    memory_total_gb: [],
    memory_percent: true,
    load_1min: undefined,
    load_5min: null,
    load_15min: Symbol('invalid')
  }
}

function simulateMissingTools(script: string, scenario: string): string {
  let modifiedScript = script

  switch (scenario) {
    case 'no_vmstat':
      // Replace vmstat commands with false to simulate missing tool
      modifiedScript = modifiedScript.replace(/command -v vmstat/g, 'false # vmstat not available')
      break
    case 'no_sysctl':
      // Replace sysctl commands with false
      modifiedScript = modifiedScript.replace(/command -v sysctl/g, 'false # sysctl not available')
      break
    case 'no_top':
      // Replace top commands with false
      modifiedScript = modifiedScript.replace(/command -v top/g, 'false # top not available')
      break
    case 'no_free':
      // Replace free commands with false
      modifiedScript = modifiedScript.replace(/command -v free/g, 'false # free not available')
      break
  }

  return modifiedScript
}

async function executeScript(scriptPath: string, input: string): Promise<{ success: boolean, output: string, error?: string }> {
  return new Promise((resolve) => {
    const process = spawn('bash', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let stdout = ''
    let stderr = ''
    
    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    process.on('close', (code) => {
      const stderrTrimmed = stderr.trim()
      resolve({
        success: code === 0,
        output: stdout.trim(),
        ...(stderrTrimmed && { error: stderrTrimmed })
      })
    })
    
    process.on('error', (err) => {
      resolve({
        success: false,
        output: '',
        error: err.message
      })
    })
    
    // Send input and close stdin
    process.stdin.write(input)
    process.stdin.end()
    
    // Timeout after 5 seconds
    setTimeout(() => {
      process.kill()
      resolve({
        success: false,
        output: stdout,
        error: 'Script execution timed out (5s)'
      })
    }, 5000)
  })
}

export function analyzeTestResult(result: TestResult, config: StatuslineConfig): {
  performance: 'excellent' | 'good' | 'slow' | 'timeout'
  hasRequiredFeatures: boolean
  issues: string[]
  suggestions: string[]
} {
  const issues: string[] = []
  const suggestions: string[] = []
  
  // Performance analysis
  let performance: 'excellent' | 'good' | 'slow' | 'timeout'
  if (result.executionTime > 1000) {
    performance = 'timeout'
    issues.push('Script execution is very slow (>1s)')
  } else if (result.executionTime > 500) {
    performance = 'slow'
    issues.push('Script execution is slow (>500ms)')
  } else if (result.executionTime > 100) {
    performance = 'good'
  } else {
    performance = 'excellent'
  }
  
  // Feature validation
  let hasRequiredFeatures = true
  
  if (config.features.includes('directory') && !result.output.includes('projects')) {
    hasRequiredFeatures = false
    issues.push('Directory feature not working properly')
  }
  
  if (config.features.includes('model') && !result.output.includes('Opus')) {
    hasRequiredFeatures = false
    issues.push('Model feature not working properly')
  }
  
  if (config.features.includes('git') && config.ccusageIntegration && !result.output.includes('git')) {
    suggestions.push('Git integration may require actual git repository')
  }

  // System monitoring validation
  if (config.features.includes('cpu') && !result.output.includes('💻') && !result.output.includes('cpu:')) {
    hasRequiredFeatures = false
    issues.push('CPU monitoring feature not working properly')
  }

  if (config.features.includes('memory') && !result.output.includes('🧠') && !result.output.includes('ram:')) {
    hasRequiredFeatures = false
    issues.push('Memory monitoring feature not working properly')
  }

  if (config.features.includes('load') && !result.output.includes('⚡') && !result.output.includes('load:')) {
    hasRequiredFeatures = false
    issues.push('System load feature not working properly')
  }
  
  // Error analysis
  if (result.error) {
    issues.push(`Script errors: ${result.error}`)
  }
  
  if (!result.success) {
    issues.push('Script failed to execute successfully')
  }
  
  // Performance suggestions
  if (config.features.length > 6) {
    suggestions.push('Consider reducing number of features for better performance')
  }
  
  if (config.ccusageIntegration && result.executionTime > 200) {
    suggestions.push('ccusage integration may slow down statusline - consider caching')
  }

  // System monitoring performance suggestions
  if (config.systemMonitoring && result.executionTime > 300) {
    suggestions.push('System monitoring may impact performance - consider increasing refresh rate')
  }

  if (config.features.some(f => ['cpu', 'memory', 'load'].includes(f)) && !config.systemMonitoring) {
    suggestions.push('System monitoring features detected but configuration missing')
  }

  // Platform-specific performance suggestions
  if (result.output.includes('WSL') || result.output.includes('microsoft')) {
    if (result.executionTime > 200) {
      suggestions.push('WSL detected - consider WSL-specific optimizations for better performance')
    }
    if (config.features.includes('load') && !result.output.includes('load:')) {
      issues.push('WSL load monitoring may need special configuration')
    }
  }

  if (result.output.includes('Darwin') && result.executionTime > 250) {
    suggestions.push('macOS detected - ensure sysctl commands are available for optimal performance')
  }
  
  return {
    performance,
    hasRequiredFeatures,
    issues,
    suggestions
  }
}