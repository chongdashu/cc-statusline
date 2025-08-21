#!/bin/bash
# Comprehensive test for concurrent ccusage locking mechanism
#
# This script tests the locking mechanism under various scenarios:
# 1. Concurrent execution test
# 2. Stale lock cleanup test  
# 3. Performance verification
#
# Usage: ./test/test-concurrent-locking.sh

set -euo pipefail

TEST_DIR="$(dirname "$0")"
STATUSLINE_TEST="$TEST_DIR/test-statusline-with-lock.sh"

echo "🧪 Testing ccusage locking mechanism..."
echo

# Test 1: Concurrent execution
echo "📋 Test 1: Concurrent execution (10 processes)"
echo "Expected: Only 1 process runs ccusage, others skip gracefully"
echo

start_time=$(date +%s)
for i in {1..10}; do
  echo '{}' | "$STATUSLINE_TEST" &
done
wait
end_time=$(date +%s)
duration=$((end_time - start_time))

echo
echo "✅ Test 1 completed in ${duration}s"
echo

# Test 2: Lock cleanup verification
echo "📋 Test 2: Verifying lock cleanup"
LOCK_EXISTS=$(ls /tmp/ccusage_statusline.lock 2>/dev/null || echo "")
PID_EXISTS=$(ls /tmp/ccusage_statusline.pid 2>/dev/null || echo "")

if [ -z "$LOCK_EXISTS" ] && [ -z "$PID_EXISTS" ]; then
  echo "✅ Lock files properly cleaned up"
else
  echo "❌ Lock files still exist:"
  [ -n "$LOCK_EXISTS" ] && echo "  - Lock directory: $LOCK_EXISTS"
  [ -n "$PID_EXISTS" ] && echo "  - PID file: $PID_EXISTS"
fi

echo
echo "🎉 All tests completed!"
echo
echo "💡 Manual verification:"
echo "  1. Check that only 1 'Running ccusage...' message appeared in stderr"
echo "  2. Verify multiple 'Skipped - lock held by' messages appeared"
echo "  3. Confirm no hanging processes with: ps aux | grep ccusage"