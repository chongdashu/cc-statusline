import { StatuslineConfig } from '../cli/prompts.js'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import inquirer from 'inquirer'

export async function installStatusline(
  script: string,
  outputPath: string,
  config: StatuslineConfig
): Promise<void> {
  try {
    // Determine the target directory based on install location
    const isGlobal = config.installLocation === 'global'
    const claudeDir = isGlobal ? path.join(os.homedir(), '.claude') : './.claude'
    const scriptPath = path.join(claudeDir, 'statusline.sh')
    
    // Ensure the directory exists
    await fs.mkdir(claudeDir, { recursive: true })

    // Check if statusline.sh already exists
    let shouldWrite = true
    try {
      await fs.access(scriptPath)
      // File exists, ask for confirmation
      const { confirmOverwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmOverwrite',
        message: `⚠️  ${isGlobal ? 'Global' : 'Project'} statusline.sh already exists. Overwrite?`,
        default: false
      }])
      shouldWrite = confirmOverwrite
    } catch {
      // File doesn't exist, proceed
    }

    if (shouldWrite) {
      // Write the script
      await fs.writeFile(scriptPath, script, { mode: 0o755 })
    } else {
      throw new Error('USER_CANCELLED_OVERWRITE')
    }

    // Update settings.json safely
    await updateSettingsJson(claudeDir, 'statusline.sh', isGlobal)

    // Note: statusline-config.json removed per user feedback - not needed
    // The statusline script contains all necessary configuration info

  } catch (error) {
    throw new Error(`Failed to install statusline: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function updateSettingsJson(claudeDir: string, scriptName: string, isGlobal: boolean): Promise<void> {
  const settingsPath = path.join(claudeDir, 'settings.json')
  
  try {
    let settings: any = {}
    let existingStatusLine: any = null
    
    // Try to read existing settings
    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf-8')
      settings = JSON.parse(settingsContent)
      existingStatusLine = settings.statusLine
    } catch {
      // File doesn't exist or invalid JSON, start fresh
    }

    // Check if statusLine already exists
    if (existingStatusLine && existingStatusLine.command) {
      // Only update if it's a statusline.sh command or user confirms
      const isOurStatusline = existingStatusLine.command?.includes('statusline.sh')
      
      if (!isOurStatusline) {
        // There's a different statusline configured, ask user
        const { confirmReplace } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmReplace',
          message: `⚠️  ${isGlobal ? 'Global' : 'Project'} settings.json already has a statusLine configured (${existingStatusLine.command}). Replace it?`,
          default: false
        }])
        
        if (!confirmReplace) {
          console.warn('\n⚠️  Statusline script was saved but settings.json was not updated.')
          console.warn('   Your existing statusLine configuration was preserved.')
          return
        }
      }
    }

    // Update statusLine configuration - Windows needs explicit bash command
    const commandPath = process.platform === 'win32'
      ? `bash ${isGlobal ? '.claude' : '.claude'}/${scriptName}`
      : (isGlobal ? `~/.claude/${scriptName}` : `.claude/${scriptName}`)
    
    settings.statusLine = {
      type: 'command',
      command: commandPath,
      padding: 0
    }

    // Write updated settings
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
    
  } catch (error) {
    // Settings update failed, but don't fail the entire installation
    console.warn(`Warning: Could not update settings.json: ${error instanceof Error ? error.message : String(error)}`)
    throw new Error('SETTINGS_UPDATE_FAILED') // Signal that manual config is needed
  }
}

export async function checkClaudeCodeSetup(): Promise<{
  hasClaudeDir: boolean
  hasSettings: boolean
  currentStatusline?: string
}> {
  const claudeDir = './.claude'
  const settingsPath = path.join(claudeDir, 'settings.json')
  
  try {
    const dirExists = await fs.access(claudeDir).then(() => true).catch(() => false)
    const settingsExists = await fs.access(settingsPath).then(() => true).catch(() => false)
    
    let currentStatusline: string | undefined
    
    if (settingsExists) {
      try {
        const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
        currentStatusline = settings.statusLine?.command
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    return {
      hasClaudeDir: dirExists,
      hasSettings: settingsExists,
      currentStatusline
    }
  } catch {
    return {
      hasClaudeDir: false,
      hasSettings: false
    }
  }
}