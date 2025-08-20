export interface ColorConfig {
  enabled: boolean
  theme: 'minimal' | 'detailed' | 'compact'
}

export function generateColorBashCode(config: ColorConfig): string {
  if (!config.enabled) {
    return `
# ---- color helpers (disabled) ----
use_color=0
C() { :; }
RST() { :; }
`
  }

  return `
# ---- color helpers (force colors for Claude Code) ----
use_color=1
[ -n "$NO_COLOR" ] && use_color=0

C() { if [ "$use_color" -eq 1 ]; then printf '\\033[%sm' "$1"; fi; }
RST() { if [ "$use_color" -eq 1 ]; then printf '\\033[0m'; fi; }
`
}

export function generateBasicColors(): string {
  return `
# ---- modern sleek colors ----
dir_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;117m'; fi; }    # sky blue
model_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;147m'; fi; }  # light purple  
version_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;180m'; fi; } # soft yellow
cc_version_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;249m'; fi; } # light gray
style_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;245m'; fi; } # gray
rst() { if [ "$use_color" -eq 1 ]; then printf '\\033[0m'; fi; }
`
}

export const COLOR_CODES = {
  // Basic colors
  BLACK: '30',
  RED: '31', 
  GREEN: '32',
  YELLOW: '33',
  BLUE: '34',
  MAGENTA: '35',
  CYAN: '36',
  WHITE: '37',
  
  // Bright colors (bold)
  BRIGHT_BLACK: '1;30',
  BRIGHT_RED: '1;31',
  BRIGHT_GREEN: '1;32', 
  BRIGHT_YELLOW: '1;33',
  BRIGHT_BLUE: '1;34',
  BRIGHT_MAGENTA: '1;35',
  BRIGHT_CYAN: '1;36',
  BRIGHT_WHITE: '1;37',
  
  // Reset
  RESET: '0'
} as const

export function getThemeColors(theme: 'minimal' | 'detailed' | 'compact') {
  switch (theme) {
    case 'minimal':
      return {
        directory: COLOR_CODES.CYAN,
        git: COLOR_CODES.GREEN,
        model: COLOR_CODES.MAGENTA,
        usage: COLOR_CODES.YELLOW,
        session: COLOR_CODES.BLUE
      }
    case 'detailed':
      return {
        directory: COLOR_CODES.BRIGHT_CYAN,
        git: COLOR_CODES.BRIGHT_GREEN,
        model: COLOR_CODES.BRIGHT_MAGENTA,
        usage: COLOR_CODES.BRIGHT_YELLOW,
        session: COLOR_CODES.BRIGHT_BLUE
      }
    case 'compact':
      return {
        directory: COLOR_CODES.CYAN,
        git: COLOR_CODES.GREEN,
        model: COLOR_CODES.BLUE,
        usage: COLOR_CODES.YELLOW,
        session: COLOR_CODES.RED
      }
  }
}