# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.7] - 2025-08-28

### Fixed
- 🐛 **ccusage Integration Fix** - Fixed ccusage stats not displaying in statusline
  - Moved `input=$(cat)` before logging to ensure proper input capture
  - Simplified ccusage execution by removing complex locking mechanism
  - Now properly calls `ccusage blocks --json` directly with internal caching
  - Fixed cost display, burn rate, token stats, and session time display

## [1.2.6] - 2025-08-27

### Fixed
- 🐛 **Installation Prompt Fix** - Fixed spinner blocking the overwrite confirmation prompt during installation
  - Removed ora spinner during installation phase to ensure prompts are visible
  - Replaced spinner with simple console messages for better UX
  - Users can now properly see and respond to overwrite confirmations

## [1.2.5] - 2025-08-27

### Fixed
- 🐛 **Cost Display Fix** - Fixed incorrect cost values (e.g., $48.00) caused by improper quoting in printf statements
  - Removed unnecessary escaped quotes around `$cost_usd` in bash generator
  - Cost values now display correctly with proper decimal formatting

## [1.2.4] - 2025-08-26

### Added
- 🆕 **Installation Location Choice** - Choose between global (`~/.claude`) or project-level (`./.claude`) installation
- 🔒 **Safe Installation** - Confirmation prompts before overwriting existing statusline.sh files
- 🛡️ **Settings Protection** - Smart settings.json updates that preserve existing configurations
- ⚠️ **Conflict Detection** - Warns when other statuslines are already configured
- ✅ **Better Error Handling** - Clear messages for cancelled installations and conflicts

### Changed
- Installation prompt now includes location selection (global vs project)
- Default installation is project-level for safety
- Improved settings.json update logic to prevent accidental overwrites

## [1.2.3] - 2025-08-20

### Fixed
- 🔒 **Critical Process Spawning Fix** - Added file-based locking mechanism to prevent infinite ccusage process spawning
- ⚡ **Performance** - Implemented 3-second timeout for ccusage calls to prevent hanging
- 🛡️ **Stability** - Added PID tracking for stale lock detection and cleanup
- 🔧 **Cross-platform** - Multiple timeout strategies for Linux, macOS, and BSD compatibility

### Contributors
- 🙏 **Special thanks to [Jonathan Borgwing (@DevVig)](https://github.com/DevVig)** for identifying and implementing the critical process spawning fix ([#4](https://github.com/chongdashu/cc-statusline/pull/4))

### Technical Details
- **File-based locking**: Uses `/tmp/ccusage_statusline.lock` directory as a mutex to ensure single execution
- **PID tracking**: Stores process ID in `/tmp/ccusage_statusline.pid` for stale lock detection  
- **Graceful degradation**: Skips execution when locked instead of queuing (prevents pile-up)
- **Automatic cleanup**: Detects and removes stale locks from crashed processes using `kill -0`
- **Cross-platform timeouts**: Multiple timeout strategies (timeout/gtimeout/fallback) for all systems
- **Testing included**: Comprehensive test suite in `test/` directory to verify locking behavior

## [1.0.1] - 2025-08-13

### Added
- CONTRIBUTING.md with comprehensive contribution guidelines
- Development workflow documentation
- Code standards and testing guidelines

### Changed
- Updated package name to unscoped `cc-statusline`
- Enhanced README contributing section with better guidance

## [1.0.0] - 2025-08-13

### Added
- Initial release of cc-statusline
- Interactive configuration wizard with 2 simple prompts
- Bash script generation with optimized performance
- Real-time ccusage integration for usage statistics
- Preview mode for testing statusline scripts with mock data
- Auto-installation with settings.json configuration
- Support for directory, git, model, usage, session, token, and burn rate features
- TTY-aware color support with NO_COLOR environment variable respect
- Manual configuration instructions when auto-update fails
- Comprehensive documentation and examples
- Performance analysis and validation in preview mode
- Timestamp and npm URL in generated script headers

### Features
- 📁 Working Directory display with `~` abbreviation
- 🌿 Git Branch integration
- 🤖 Model Name & Version display
- 💵 Real-time Usage & Cost tracking
- ⌛ Session Time Remaining with progress bars
- 📊 Token Statistics (optional)
- ⚡ Burn Rate monitoring (optional)

### Technical
- TypeScript with strict type checking
- ESM module support
- Commander.js for CLI interface
- Inquirer.js for interactive prompts
- Chalk for colorized output
- Ora for loading spinners
- Comprehensive error handling and validation
- Modular architecture for easy maintenance

[1.0.0]: https://github.com/chongdashu/cc-statusline/releases/tag/v1.0.0