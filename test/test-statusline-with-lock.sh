#!/bin/bash
# Test script for ccusage process locking mechanism
# 
# This script simulates the file-based locking behavior implemented in the
# ccusage integration to prevent concurrent process spawning.
#
# Usage: echo '{}' | ./test/test-statusline-with-lock.sh
#
# To test concurrent execution:
#   for i in {1..10}; do echo '{}' | ./test/test-statusline-with-lock.sh & done
#
# Expected behavior:
# - Only one process should run ccusage at a time
# - Other processes should skip execution gracefully
# - No process pile-up or resource leaks should occur

set -euo pipefail

# Mock JSON input handling
json_input=$(cat)

# Implement file-based locking to prevent concurrent executions
LOCK_FILE="/tmp/ccusage_statusline.lock"
LOCK_PID_FILE="/tmp/ccusage_statusline.pid"

# Function to check if process is still running
is_process_running() {
  local pid=$1
  if [ -z "$pid" ]; then return 1; fi
  kill -0 "$pid" 2>/dev/null
}

# Try to acquire lock
if mkdir "$LOCK_FILE" 2>/dev/null; then
  # Lock acquired, save our PID
  echo $$ > "$LOCK_PID_FILE"
  
  # Run ccusage with timeout (simulated with echo for testing)
  echo "[$$] Running ccusage..." >&2
  
  # Simulate ccusage work
  sleep 0.5
  
  # Generate mock output
  echo "📁 ~/test  🌿 main  🤖 Claude  [simulated from $$]"
  
  # Clean up lock
  rm -f "$LOCK_PID_FILE" 2>/dev/null
  rmdir "$LOCK_FILE" 2>/dev/null
else
  # Lock exists, check if it's stale
  if [ -f "$LOCK_PID_FILE" ]; then
    old_pid=$(cat "$LOCK_PID_FILE" 2>/dev/null)
    if ! is_process_running "$old_pid"; then
      # Stale lock, clean it up
      echo "[$$] Cleaning stale lock from $old_pid" >&2
      rm -f "$LOCK_PID_FILE" 2>/dev/null
      rmdir "$LOCK_FILE" 2>/dev/null
    else
      echo "[$$] Skipped - lock held by $old_pid" >&2
    fi
  else
    echo "[$$] Skipped - lock exists" >&2
  fi
  # Return cached/default output when skipped
  echo "📁 ~/test  🌿 main  🤖 Claude  [cached]"
fi
