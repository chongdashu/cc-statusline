# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-statusline is a TypeScript CLI tool that generates custom statuslines for Claude Code. It creates optimized bash scripts that display directory, git info, model name, usage costs, and session time in the terminal.

## Development Commands

```bash
# Install dependencies
npm install

# Build the project (required before testing)
npm run build

# Watch mode for development
npm run dev

# Test the CLI locally
./dist/index.js init --no-install
./dist/index.js preview ./test-statusline.sh

# Test as if installed globally
npx . init
```

## Architecture

The codebase follows a modular ESM TypeScript architecture:

- **CLI Layer** (`src/cli/`): Commander.js-based CLI with interactive prompts using Inquirer
- **Generator Layer** (`src/generators/`): Creates optimized bash scripts based on user configuration
- **Feature Modules** (`src/features/`): Isolated implementations for git, usage tracking, and colors
- **Utility Layer** (`src/utils/`): Installation, validation, and testing utilities

Key design patterns:
- Feature flags determine which bash code blocks are included in generated scripts
- All bash generation is template-based with conditional sections
- Mock testing simulates Claude Code's JSON input for preview functionality

## Key Implementation Details

**Build System**: Uses tsup for ESM bundling with Node 16+ target. The `#!/usr/bin/env node` shebang is automatically added during build.

**Generated Scripts**: The bash statuslines are self-contained with graceful fallbacks when dependencies (jq, git, ccusage) are missing. Scripts execute in <100ms with minimal resource usage.

**Installation Flow**: 
1. Collects user preferences via inquirer prompts
2. Generates optimized bash script with only selected features
3. Writes to `.claude/statusline.sh` with execute permissions
4. Updates `.claude/settings.json` to register the statusline command

**Testing Approach**: Preview command uses mock Claude Code JSON data to test statuslines before installation. Real testing requires manual verification with Claude Code running.

## Important Conventions

- Use ESM imports with `.js` extensions (even for `.ts` files)
- Maintain 2-space indentation without semicolons
- Follow conventional commits format for commit messages
- Generated bash scripts must be POSIX-compliant with fallbacks