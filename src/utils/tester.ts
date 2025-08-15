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

export function generateMockSystemData(): any {
  return {
    cpu_percent: 45.2,
    memory_used_gb: 8,
    memory_total_gb: 16,
    memory_percent: 50.0,
    load_1min: 1.25,
    load_5min: 1.15,
    load_15min: 0.98,
    platform: "Linux"
  }
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
  
  return {
    performance,
    hasRequiredFeatures,
    issues,
    suggestions
  }
}