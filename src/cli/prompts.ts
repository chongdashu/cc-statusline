import inquirer from 'inquirer'

export interface StatuslineConfig {
  features: string[]
  runtime: 'bash' | 'python' | 'node'
  colors: boolean
  theme: 'minimal' | 'detailed' | 'compact'
  ccusageIntegration: boolean
  logging: boolean
  customEmojis: boolean
  systemMonitoring?: {
    refreshRate: number
    cpuThreshold: number
    memoryThreshold: number
    loadThreshold: number
  }
}

export async function collectConfiguration(): Promise<StatuslineConfig> {
  console.log('🚀 Welcome to cc-statusline! Let\'s create your custom Claude Code statusline.\n')

  const config = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'features',
      message: 'What would you like to display in your statusline?',
      choices: [
        { name: '📁 Working Directory', value: 'directory', checked: true },
        { name: '🌿 Git Branch', value: 'git', checked: true },
        { name: '🤖 Model Name & Version', value: 'model', checked: true },
        { name: '💻 CPU Usage', value: 'cpu', checked: false },
        { name: '🧠 RAM Usage', value: 'memory', checked: false },
        { name: '⚡ System Load', value: 'load', checked: false },
        { name: '💵 Usage & Cost', value: 'usage', checked: true },
        { name: '⌛ Session Time Remaining', value: 'session', checked: true },
        { name: '📊 Token Statistics', value: 'tokens', checked: false },
        { name: '🔥 Burn Rate (tokens/min)', value: 'burnrate', checked: false }
      ],
      validate: (answer: string[]) => {
        if (answer.length < 1) {
          return 'You must choose at least one feature.'
        }
        return true
      }
    },
    {
      type: 'confirm',
      name: 'colors',
      message: 'Enable colors and emojis?',
      default: true
    }
  ])

  // Add system monitoring configuration if system features are selected
  const hasSystemFeatures = config.features.some((f: string) => ['cpu', 'memory', 'load'].includes(f))
  
  if (hasSystemFeatures) {
    const systemConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'refreshRate',
        message: 'System monitoring refresh rate (seconds):',
        default: '3',
        validate: (input: string) => {
          const num = parseInt(input)
          if (isNaN(num) || num < 1 || num > 60) {
            return 'Please enter a number between 1 and 60 seconds'
          }
          return true
        }
      },
      {
        type: 'input',
        name: 'cpuThreshold',
        message: 'CPU usage warning threshold (percentage):',
        default: '75',
        validate: (input: string) => {
          const num = parseInt(input)
          if (isNaN(num) || num < 10 || num > 95) {
            return 'Please enter a number between 10 and 95 percent'
          }
          return true
        }
      },
      {
        type: 'input',
        name: 'memoryThreshold',
        message: 'Memory usage warning threshold (percentage):',
        default: '80',
        validate: (input: string) => {
          const num = parseInt(input)
          if (isNaN(num) || num < 10 || num > 95) {
            return 'Please enter a number between 10 and 95 percent'
          }
          return true
        }
      },
      {
        type: 'input',
        name: 'loadThreshold',
        message: 'System load warning threshold (load average):',
        default: '2.0',
        validate: (input: string) => {
          const num = parseFloat(input)
          if (isNaN(num) || num < 0.1 || num > 10.0) {
            return 'Please enter a number between 0.1 and 10.0'
          }
          return true
        }
      }
    ])
    
    // Merge system monitoring config
    config.systemMonitoring = {
      refreshRate: parseInt(systemConfig.refreshRate),
      cpuThreshold: parseInt(systemConfig.cpuThreshold),
      memoryThreshold: parseInt(systemConfig.memoryThreshold),
      loadThreshold: parseFloat(systemConfig.loadThreshold)
    }
  }

  // Set intelligent defaults for system monitoring if not already configured
  if (!config.systemMonitoring && hasSystemFeatures) {
    config.systemMonitoring = {
      refreshRate: 3, // 3 second default refresh rate
      cpuThreshold: 75,
      memoryThreshold: 80,
      loadThreshold: 2.0
    }
  }
  
  return {
    features: config.features,
    runtime: 'bash',
    colors: config.colors,
    theme: 'detailed',
    ccusageIntegration: true, // Always enabled since npx works
    logging: false,
    customEmojis: false,
    ...config
  } as StatuslineConfig
}

export function displayConfigSummary(config: StatuslineConfig): void {
  console.log('\n✅ Configuration Summary:')
  console.log(`   Runtime: ${config.runtime}`)
  console.log(`   Theme: ${config.theme}`)
  console.log(`   Colors: ${config.colors ? '✅' : '❌'}`)
  console.log(`   Features: ${config.features.join(', ')}`)
  
  if (config.ccusageIntegration) {
    console.log('   📊 ccusage integration enabled')
  }
  
  if (config.logging) {
    console.log('   📝 Debug logging enabled')
  }
  
  if (config.systemMonitoring) {
    console.log(`   💻 System monitoring enabled (${config.systemMonitoring.refreshRate}s refresh)`)
    console.log(`      CPU threshold: ${config.systemMonitoring.cpuThreshold}%, Memory: ${config.systemMonitoring.memoryThreshold}%, Load: ${config.systemMonitoring.loadThreshold}`)
  }
  
  console.log('')
}