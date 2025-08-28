import { collectConfiguration, displayConfigSummary } from './prompts.js'
import { generateBashStatusline } from '../generators/bash-generator.js'
import { validateConfig } from '../utils/validator.js'
import { installStatusline } from '../utils/installer.js'
import chalk from 'chalk'
import ora from 'ora'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

interface InitOptions {
  output?: string
  install?: boolean
}

function checkJqInstallation(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function getJqInstallInstructions(): string {
  const platform = process.platform
  
  if (platform === 'darwin') {
    return `
${chalk.cyan('📦 Install jq for better performance and reliability:')}

${chalk.green('Using Homebrew (recommended):')}
  brew install jq

${chalk.green('Using MacPorts:')}
  sudo port install jq

${chalk.green('Or download directly:')}
  https://github.com/jqlang/jq/releases
`
  } else if (platform === 'linux') {
    return `
${chalk.cyan('📦 Install jq for better performance and reliability:')}

${chalk.green('Ubuntu/Debian:')}
  sudo apt-get install jq

${chalk.green('CentOS/RHEL/Fedora:')}
  sudo yum install jq

${chalk.green('Arch Linux:')}
  sudo pacman -S jq

${chalk.green('Or download directly:')}
  https://github.com/jqlang/jq/releases
`
  } else if (platform === 'win32') {
    return `
${chalk.cyan('📦 Install jq for better performance and reliability:')}

${chalk.green('Option 1: Using Package Manager')}
  ${chalk.dim('Chocolatey:')} choco install jq
  ${chalk.dim('Scoop:')} scoop install jq

${chalk.green('Option 2: Manual Download')}
  1. Download from: https://github.com/jqlang/jq/releases/latest
  2. Choose file:
     ${chalk.dim('• 64-bit Windows:')} jq-windows-amd64.exe
     ${chalk.dim('• 32-bit Windows:')} jq-windows-i386.exe
  3. Rename to: jq.exe
  4. Move to: C:\\Windows\\System32\\ ${chalk.dim('(or add to PATH)')}
  5. Test: Open new terminal and run: jq --version
`
  } else {
    return `
${chalk.cyan('📦 Install jq for better performance and reliability:')}

${chalk.green('Download for your platform:')}
  https://github.com/jqlang/jq/releases
`
  }
}

export async function initCommand(options: InitOptions): Promise<void> {
  try {
    const spinner = ora('Initializing statusline generator...').start()
    await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause for UX
    spinner.stop()

    // Check for jq installation
    const hasJq = checkJqInstallation()
    if (!hasJq) {
      console.log(chalk.yellow('\n⚠️  jq is not installed'))
      console.log(chalk.dim('Your statusline will work without jq, but with limited functionality:'))
      console.log(chalk.dim('  • Context remaining percentage won\'t be displayed'))
      console.log(chalk.dim('  • Token statistics may not work'))
      console.log(chalk.dim('  • Performance will be slower'))
      console.log(getJqInstallInstructions())
      
      // Ask if they want to continue without jq
      const inquirer = (await import('inquirer')).default
      const { continueWithoutJq } = await inquirer.prompt([{
        type: 'confirm',
        name: 'continueWithoutJq',
        message: 'Continue without jq?',
        default: true
      }])
      
      if (!continueWithoutJq) {
        console.log(chalk.cyan('\n👍 Install jq and run this command again'))
        process.exit(0)
      }
    }

    // Collect user configuration
    const config = await collectConfiguration()
    
    // Validate configuration
    const validation = validateConfig(config)
    if (!validation.isValid) {
      console.error(chalk.red('❌ Configuration validation failed:'))
      validation.errors.forEach(error => console.error(chalk.red(`   • ${error}`)))
      process.exit(1)
    }

    // Generate statusline script
    const generationSpinner = ora('Generating statusline script...').start()
    
    const script = generateBashStatusline(config)
    const filename = 'statusline.sh'
    
    generationSpinner.succeed('Statusline script generated!')

    // Show preview of what it will look like
    console.log(chalk.cyan('\n✨ Your statusline will look like:'))
    console.log(chalk.white('━'.repeat(60)))
    
    // Generate preview using the test function
    const { testStatuslineScript, generateMockClaudeInput } = await import('../utils/tester.js')
    const mockInput = generateMockClaudeInput()
    const testResult = await testStatuslineScript(script, mockInput)
    
    if (testResult.success) {
      console.log(testResult.output)
    } else {
      console.log(chalk.gray('📁 ~/projects/my-app  🌿 main  🤖 Claude  💵 $2.48 ($12.50/h)'))
      console.log(chalk.gray('(Preview unavailable - will work when Claude Code runs it)'))
    }
    
    console.log(chalk.white('━'.repeat(60)))

    // Determine output path based on installation location
    const isGlobal = config.installLocation === 'global'
    const baseDir = isGlobal ? os.homedir() : '.'
    const outputPath = options.output || path.join(baseDir, '.claude', filename)
    const resolvedPath = path.resolve(outputPath)

    // Install the statusline
    if (options.install !== false) {
      console.log(chalk.cyan('\n📦 Installing statusline...'))
      
      try {
        await installStatusline(script, resolvedPath, config)
        
        console.log(chalk.green('\n✅ Statusline installed!'))
        console.log(chalk.green('\n🎉 Success! Your custom statusline is ready!'))
        console.log(chalk.cyan(`\n📁 ${isGlobal ? 'Global' : 'Project'} installation complete: ${chalk.white(resolvedPath)}`))
        console.log(chalk.cyan('\nNext steps:'))
        console.log(chalk.white('   1. Restart Claude Code to see your new statusline'))
        console.log(chalk.white('   2. Usage statistics work via: npx ccusage@latest'))
        
      } catch (error) {
        console.log(chalk.red('\n❌ Failed to install statusline'))
        
        if (error instanceof Error && error.message === 'USER_CANCELLED_OVERWRITE') {
          console.log(chalk.yellow('\n⚠️  Installation cancelled. Existing statusline.sh was not overwritten.'))
        } else if (error instanceof Error && error.message === 'SETTINGS_UPDATE_FAILED') {
          const commandPath = isGlobal ? '~/.claude/statusline.sh' : '.claude/statusline.sh'
          console.log(chalk.yellow('\n⚠️  Settings.json could not be updated automatically.'))
          console.log(chalk.cyan('\nManual Configuration Required:'))
          console.log(chalk.white(`Add this to your ${isGlobal ? '~/.claude' : '.claude'}/settings.json file:`))
          console.log(chalk.gray('\n{'))
          console.log(chalk.gray('  "statusLine": {'))
          console.log(chalk.gray('    "type": "command",'))
          console.log(chalk.gray(`    "command": "${commandPath}",`))
          console.log(chalk.gray('    "padding": 0'))
          console.log(chalk.gray('  }'))
          console.log(chalk.gray('}'))
          console.log(chalk.cyan(`\n📁 Statusline script saved to: ${chalk.white(resolvedPath)}`))
        } else {
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
          console.log(chalk.cyan(`\n📁 You can manually save the script to: ${chalk.white(resolvedPath)}`))
        }
      }
    } else {
      // Just display where to save it
      console.log(chalk.green('\n✅ Statusline generated successfully!'))
      console.log(chalk.cyan(`\n📁 Save this script to: ${chalk.white(resolvedPath)}`))
      console.log(chalk.cyan('\nThen restart Claude Code to see your new statusline.'))
    }

  } catch (error) {
    console.error(chalk.red('❌ An error occurred:'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}