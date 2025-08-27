import { Command } from 'commander'
import { initCommand } from './cli/commands.js'
import chalk from 'chalk'

const program = new Command()

program
  .name('cc-statusline')
  .description('Interactive CLI tool for generating custom Claude Code statuslines')
  .version('1.2.6')

program
  .command('init')
  .description('Create a custom statusline with interactive prompts')
  .option('-o, --output <path>', 'Output path for statusline.sh', './.claude/statusline.sh')
  .option('--no-install', 'Don\'t automatically install to .claude/statusline.sh')
  .action(initCommand)

program
  .command('preview')
  .description('Preview existing statusline.sh with mock data')
  .argument('<script-path>', 'Path to statusline.sh file to preview')
  .action(async (scriptPath) => {
    const { previewCommand } = await import('./cli/preview.js')
    await previewCommand(scriptPath)
  })

program
  .command('test')
  .description('Test statusline with real Claude Code JSON input')
  .option('-c, --config <path>', 'Configuration file to test')
  .action(() => {
    console.log(chalk.yellow('Test command coming soon!'))
  })

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}

program.parse(process.argv)