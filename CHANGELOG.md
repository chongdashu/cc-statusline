# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2025-08-20

### Fixed
- 🔒 **Critical Process Spawning Fix** - Added file-based locking mechanism to prevent infinite ccusage process spawning
- ⚡ **Performance** - Implemented 3-second timeout for ccusage calls to prevent hanging
- 🛡️ **Stability** - Added PID tracking for stale lock detection and cleanup
- 🔧 **Cross-platform** - Multiple timeout strategies for Linux, macOS, and BSD compatibility

### Technical Details
- Uses `/tmp/ccusage_statusline.lock` as a mutex to ensure single execution
- Gracefully skips execution when locked instead of queuing (prevents pile-up)
- Automatic cleanup of stale locks from crashed processes
- Fallback timeout mechanism for systems without GNU coreutils

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