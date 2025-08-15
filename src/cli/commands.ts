import { collectConfiguration, displayConfigSummary } from './prompts.js'
import { generateBashStatusline } from '../generators/bash-generator.js'
import { validateConfig } from '../utils/validator.js'
import { installStatusline } from '../utils/installer.js'
import chalk from 'chalk'
import ora from 'ora'
import path from 'path'

interface InitOptions {
  output?: string
  install?: boolean
}

export async function initCommand(options: InitOptions): Promise<void> {
  try {
    const spinner = ora('Initializing statusline generator...').start()
    await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause for UX
    spinner.stop()

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

    // Determine output path
    const outputPath = options.output || `./.claude/${filename}`
    const resolvedPath = path.resolve(outputPath)

    // Always write the script file first
    const writeSpinner = ora('Writing statusline script...').start()
    try {
      // Ensure directory exists and write the script
      const dir = path.dirname(resolvedPath)
      const fs = await import('fs/promises')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(resolvedPath, script, { mode: 0o755 })
      writeSpinner.succeed('Statusline script generated!')
    } catch (error) {
      writeSpinner.fail('Failed to write statusline script')
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }

    // Handle settings installation if requested
    if (options.install !== false) {
      const installSpinner = ora('Installing statusline configuration...').start()
      
      try {
        // Only update settings, script is already written
        const { updateSettingsJson } = await import('../utils/installer.js')
        await updateSettingsJson(path.dirname(resolvedPath), path.basename(resolvedPath))
        installSpinner.succeed('✅ Statusline installed!')
        
        console.log(chalk.green('\n🎉 Success! Your custom statusline is ready!'))
        console.log(chalk.cyan(`\n📁 Generated file: ${chalk.white(resolvedPath)}`))
        console.log(chalk.cyan('\nNext steps:'))
        console.log(chalk.white('   1. Restart Claude Code to see your new statusline'))
        console.log(chalk.white('   2. Usage statistics work via: npx ccusage@latest'))
        
      } catch (error) {
        installSpinner.fail('Failed to install statusline configuration')
        
        console.log(chalk.yellow('\n⚠️  Settings.json could not be updated automatically.'))
        console.log(chalk.cyan('\nManual Configuration Required:'))
        console.log(chalk.white('Add this to your .claude/settings.json file:'))
        console.log(chalk.gray('\n{'))
        console.log(chalk.gray('  "statusLine": {'))
        console.log(chalk.gray('    "type": "command",'))
        console.log(chalk.gray(`    "command": ".claude/statusline.sh",`))
        console.log(chalk.gray('    "padding": 0'))
        console.log(chalk.gray('  }'))
        console.log(chalk.gray('}'))
        console.log(chalk.cyan(`\n📁 Statusline script saved to: ${chalk.white(resolvedPath)}`))
      }
    } else {
      // --no-install: Script is already written, just inform user
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