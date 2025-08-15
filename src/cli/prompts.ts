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

  // Set intelligent defaults
  const hasSystemMonitoring = config.features.some((f: string) => ['cpu', 'memory', 'load'].includes(f))
  
  return {
    features: config.features,
    runtime: 'bash',
    colors: config.colors,
    theme: 'detailed',
    ccusageIntegration: true, // Always enabled since npx works
    logging: false,
    customEmojis: false,
    ...(hasSystemMonitoring && {
      systemMonitoring: {
        refreshRate: 3, // 3 second default refresh rate
        cpuThreshold: 80,
        memoryThreshold: 85
      }
    })
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
  }
  
  console.log('')
}