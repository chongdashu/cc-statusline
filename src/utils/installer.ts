import { StatuslineConfig } from '../cli/prompts.js'
import { promises as fs } from 'fs'
import path from 'path'

export async function installStatusline(
  script: string,
  outputPath: string,
  config: StatuslineConfig
): Promise<void> {
  try {
    // Ensure the directory exists
    const dir = path.dirname(outputPath)
    await fs.mkdir(dir, { recursive: true })

    // Write the script
    await fs.writeFile(outputPath, script, { mode: 0o755 })

    // Update .claude/settings.json if it exists
    await updateSettingsJson(dir, path.basename(outputPath))

    // Note: statusline-config.json removed per user feedback - not needed
    // The statusline script contains all necessary configuration info

  } catch (error) {
    throw new Error(`Failed to install statusline: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function updateSettingsJson(claudeDir: string, scriptName: string): Promise<void> {
  const settingsPath = path.join(claudeDir, 'settings.json')
  
  try {
    let settings: any = {}
    
    // Try to read existing settings
    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf-8')
      settings = JSON.parse(settingsContent)
    } catch {
      // File doesn't exist or invalid JSON, start fresh
    }

    // Update statusLine configuration
    settings.statusLine = {
      type: 'command',
      command: `.claude/${scriptName}`,
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