# Fix for Infinite Node Spawning Issue

## Problem
The cc-statusline was causing infinite spawning of ccusage processes, leading to:
- CPU usage over 300%
- 30+ simultaneous Node.js processes
- Memory consumption exceeding 3GB
- System becoming unresponsive

## Root Cause
The statusline script was calling `npx ccusage@latest blocks --json` without any concurrency control. When Claude Code rapidly triggered the statusline (e.g., every keystroke), multiple ccusage processes would spawn before previous ones completed.

## Solution Implemented
Added a robust file-based locking mechanism with the following features:

1. **Process-based semaphore**: Uses `/tmp/ccusage_statusline.lock` directory as a mutex
2. **PID tracking**: Stores process ID to detect and clean up stale locks
3. **Timeout protection**: Implements 3-second timeout for ccusage execution
4. **Cross-platform support**: Works on Linux, macOS, and systems with/without GNU coreutils
5. **Graceful degradation**: If a lock exists, the script skips ccusage call rather than queuing

## Key Changes
- Modified `src/features/usage.ts` to generate bash code with locking mechanism
- Added process existence checking with `kill -0`
- Implemented timeout using `timeout`/`gtimeout` commands where available
- Added fallback timeout mechanism using background processes for systems without timeout command

## Testing Results
- Successfully prevents concurrent ccusage executions
- Only one process runs at a time, others skip gracefully
- No leftover processes after execution
- Significantly reduced resource consumption

## Compatibility
- Works with ccusage versions that support the `blocks --json` command
- Compatible with bash on Linux, macOS, and BSD systems
- Gracefully handles systems without GNU coreutils

## Version
Bumped to 1.0.3 to include this critical fix.