import inquirer from 'inquirer'

export interface StatuslineConfig {
  features: string[]
  runtime: 'bash' | 'python' | 'node'
  colors: boolean
  theme: 'minimal' | 'detailed' | 'compact'
  ccusageIntegration: boolean
  logging: boolean
  customEmojis: boolean
  installLocation?: 'global' | 'project'
}

export async function collectConfiguration(): Promise<StatuslineConfig> {
  console.log('🚀 Welcome to cc-statusline! Let\'s create your custom Claude Code statusline.\n')
  console.log('✨ All features are enabled by default. Use ↑/↓ arrows to navigate, SPACE to toggle, ENTER to continue.\n')
  
  const config = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select statusline features (scroll down for more options):',
      choices: [
        { name: '📁 Working Directory', value: 'directory', checked: true },
        { name: '🌿 Git Branch', value: 'git', checked: true },
        { name: '🤖 Model Name & Version', value: 'model', checked: true },
        { name: '📟 Claude Code Version', value: 'ccversion', checked: true },
        { name: '🎨 Output Style', value: 'outputstyle', checked: true },
        { name: '🧠 Context Remaining', value: 'context', checked: true },
        { name: '⌛ Session Reset Time (requires ccusage)', value: 'session', checked: false },
        { name: '💵 Usage & Cost', value: 'usage', checked: true },
        { name: '📊 Token Statistics', value: 'tokens', checked: true },
        { name: '⚡ Burn Rate ($/hr & tokens/min)', value: 'burnrate', checked: true }
      ],
      validate: (answer: string[]) => {
        if (answer.length < 1) {
          return 'You must choose at least one feature.'
        }
        return true
      },
      pageSize: 10
    },
    {
      type: 'confirm',
      name: 'colors',
      message: '\n🎨 Enable modern color scheme and emojis?',
      default: true
    },
    {
      type: 'confirm',
      name: 'logging',
      message: '\n📝 Enable debug logging to .claude/statusline.log?',
      default: false
    },
    {
      type: 'list',
      name: 'installLocation',
      message: '\n📍 Where would you like to install the statusline?',
      choices: [
        { name: '🏠 Global (~/.claude) - Use across all projects', value: 'global' },
        { name: '📂 Project (./.claude) - Only for this project', value: 'project' }
      ],
      default: 'project'
    }
  ])

  // Set intelligent defaults
  // ccusage is only needed for session reset time feature
  const needsCcusage = config.features.includes('session')

  return {
    features: config.features,
    runtime: 'bash',
    colors: config.colors,
    theme: 'detailed',
    ccusageIntegration: needsCcusage,
    logging: config.logging,
    customEmojis: false,
    installLocation: config.installLocation
  } as StatuslineConfig
}

export function displayConfigSummary(config: StatuslineConfig): void {
  console.log('\n✅ Configuration Summary:')
  console.log(`   Runtime: ${config.runtime}`)
  console.log(`   Theme: ${config.theme}`)
  console.log(`   Colors: ${config.colors ? '✅' : '❌'}`)
  console.log(`   Features: ${config.features.join(', ')}`)

  if (config.ccusageIntegration) {
    console.log('   ⚠️  Session reset time requires ccusage (npx ccusage@latest)')
  }

  if (config.logging) {
    console.log('   📝 Debug logging enabled')
  }

  console.log('')
}