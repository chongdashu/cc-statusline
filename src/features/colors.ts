import { optimizeBashCode } from '../generators/bash-optimizer.js'

export interface ColorConfig {
  enabled: boolean
  theme: 'minimal' | 'detailed' | 'compact'
}

export function generateColorBashCode(config: ColorConfig): string {
  let bashCode: string

  if (!config.enabled) {
    bashCode = `
# ---- color helpers (disabled) ----
use_color=0
C() { :; }
RST() { :; }
`
  } else {
    bashCode = `
# ---- color helpers (modern terminal-aware, respect NO_COLOR) ----
use_color=1

# Honor explicit environment variables
[[ $NO_COLOR ]] && use_color=0
[[ $FORCE_COLOR ]] && use_color=1

# Detect modern terminals (more permissive than TTY-only)
if (( use_color && ! FORCE_COLOR )); then
  # Check for explicit color support indicators
  case "$TERM" in
    *color*|*-256color|xterm*|screen*|tmux*) 
      use_color=1 ;;
    dumb|unknown) 
      use_color=0 ;;
    *) 
      # Default to colors for modern environments (WSL, containers, etc.)
      # Only disable if we're definitely not in a capable terminal
      [[ -t 1 ]] || use_color=1  # Enable colors even for non-TTY if not explicitly disabled
      ;;
  esac
fi

C() { (( use_color )) && printf '\\033[%sm' "$1"; }
RST() { (( use_color )) && printf '\\033[0m'; }
`
  }

  return optimizeBashCode(bashCode)
}

export function generateBasicColors(): string {
  const bashCode = `
# ---- basic colors ----
dir_clr() { (( use_color )) && printf '\\033[1;36m'; }    # cyan
model_clr() { (( use_color )) && printf '\\033[1;35m'; }  # magenta  
ver_clr() { (( use_color )) && printf '\\033[1;33m'; } # yellow
rst() { (( use_color )) && printf '\\033[0m'; }
`

  return optimizeBashCode(bashCode)
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