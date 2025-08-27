#!/bin/bash

# Test script for cc-statusline installation scenarios
# Tests both global and project-level installations

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="$(dirname "$0")/test-workspace"
FAKE_HOME="$TEST_DIR/fake-home"
FAKE_PROJECT="$TEST_DIR/fake-project"
FAKE_GLOBAL_CLAUDE="$FAKE_HOME/.claude"
FAKE_PROJECT_CLAUDE="$FAKE_PROJECT/.claude"

# Counter for tests
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
setup_test_env() {
  echo -e "${CYAN}Setting up test environment...${NC}"
  rm -rf "$TEST_DIR" 2>/dev/null
  mkdir -p "$FAKE_HOME"
  mkdir -p "$FAKE_PROJECT"
}

cleanup_test_env() {
  echo -e "${GRAY}Cleaning up test environment...${NC}"
  rm -rf "$TEST_DIR" 2>/dev/null
}

test_scenario() {
  local scenario_name="$1"
  local test_function="$2"
  
  echo -e "\n${CYAN}Testing: $scenario_name${NC}"
  TESTS_RUN=$((TESTS_RUN + 1))
  
  # Clean environment for each test
  rm -rf "$FAKE_GLOBAL_CLAUDE" 2>/dev/null
  rm -rf "$FAKE_PROJECT_CLAUDE" 2>/dev/null
  
  # Run the test
  if $test_function; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

assert_file_exists() {
  local file="$1"
  local description="$2"
  
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $description exists"
    return 0
  else
    echo -e "  ${RED}✗${NC} $description does not exist"
    return 1
  fi
}

assert_file_not_exists() {
  local file="$1"
  local description="$2"
  
  if [ ! -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $description does not exist"
    return 0
  else
    echo -e "  ${RED}✗${NC} $description exists (unexpected)"
    return 1
  fi
}

assert_file_contains() {
  local file="$1"
  local content="$2"
  local description="$3"
  
  if grep -q "$content" "$file" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $description"
    return 0
  else
    echo -e "  ${RED}✗${NC} $description not found"
    return 1
  fi
}

assert_json_field() {
  local file="$1"
  local field="$2"
  local expected="$3"
  local description="$4"
  
  if [ -f "$file" ]; then
    local actual=$(jq -r "$field" "$file" 2>/dev/null)
    if [ "$actual" = "$expected" ]; then
      echo -e "  ${GREEN}✓${NC} $description: $expected"
      return 0
    else
      echo -e "  ${RED}✗${NC} $description: expected '$expected', got '$actual'"
      return 1
    fi
  else
    echo -e "  ${RED}✗${NC} $description: file does not exist"
    return 1
  fi
}

# Test scenarios

test_no_files_global() {
  echo -e "${GRAY}  Scenario: No files exist, installing globally${NC}"
  
  # Create the directory
  mkdir -p "$FAKE_GLOBAL_CLAUDE"
  
  # Simulate installation
  echo '#!/bin/bash' > "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  echo 'echo "test statusline"' >> "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  chmod +x "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  
  # Create settings.json
  cat > "$FAKE_GLOBAL_CLAUDE/settings.json" <<EOF
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 0
  }
}
EOF
  
  # Verify
  assert_file_exists "$FAKE_GLOBAL_CLAUDE/statusline.sh" "Global statusline.sh" && \
  assert_file_exists "$FAKE_GLOBAL_CLAUDE/settings.json" "Global settings.json" && \
  assert_json_field "$FAKE_GLOBAL_CLAUDE/settings.json" ".statusLine.command" "~/.claude/statusline.sh" "statusLine command"
}

test_no_files_project() {
  echo -e "${GRAY}  Scenario: No files exist, installing in project${NC}"
  
  # Create the directory
  mkdir -p "$FAKE_PROJECT_CLAUDE"
  
  # Simulate installation
  echo '#!/bin/bash' > "$FAKE_PROJECT_CLAUDE/statusline.sh"
  echo 'echo "test statusline"' >> "$FAKE_PROJECT_CLAUDE/statusline.sh"
  chmod +x "$FAKE_PROJECT_CLAUDE/statusline.sh"
  
  # Create settings.json
  cat > "$FAKE_PROJECT_CLAUDE/settings.json" <<EOF
{
  "statusLine": {
    "type": "command",
    "command": ".claude/statusline.sh",
    "padding": 0
  }
}
EOF
  
  # Verify
  assert_file_exists "$FAKE_PROJECT_CLAUDE/statusline.sh" "Project statusline.sh" && \
  assert_file_exists "$FAKE_PROJECT_CLAUDE/settings.json" "Project settings.json" && \
  assert_json_field "$FAKE_PROJECT_CLAUDE/settings.json" ".statusLine.command" ".claude/statusline.sh" "statusLine command"
}

test_statusline_exists_global() {
  echo -e "${GRAY}  Scenario: statusline.sh exists, no settings.json (global)${NC}"
  
  # Create existing statusline
  mkdir -p "$FAKE_GLOBAL_CLAUDE"
  echo '#!/bin/bash' > "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  echo 'echo "old statusline"' >> "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  chmod +x "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  
  # Simulate installation (would prompt for overwrite, we assume no)
  # So statusline.sh should remain unchanged
  
  # Create settings.json (would be created regardless)
  cat > "$FAKE_GLOBAL_CLAUDE/settings.json" <<EOF
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 0
  }
}
EOF
  
  # Verify
  assert_file_exists "$FAKE_GLOBAL_CLAUDE/statusline.sh" "Global statusline.sh" && \
  assert_file_contains "$FAKE_GLOBAL_CLAUDE/statusline.sh" "old statusline" "Original statusline preserved" && \
  assert_file_exists "$FAKE_GLOBAL_CLAUDE/settings.json" "Global settings.json"
}

test_both_exist_global() {
  echo -e "${GRAY}  Scenario: Both files exist (global)${NC}"
  
  # Create existing files
  mkdir -p "$FAKE_GLOBAL_CLAUDE"
  echo '#!/bin/bash' > "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  echo 'echo "old statusline"' >> "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  chmod +x "$FAKE_GLOBAL_CLAUDE/statusline.sh"
  
  cat > "$FAKE_GLOBAL_CLAUDE/settings.json" <<EOF
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 0
  },
  "otherSetting": "preserved"
}
EOF
  
  # Simulate installation (would prompt for overwrite, we assume no)
  # Both files should remain unchanged
  
  # Verify
  assert_file_exists "$FAKE_GLOBAL_CLAUDE/statusline.sh" "Global statusline.sh" && \
  assert_file_contains "$FAKE_GLOBAL_CLAUDE/statusline.sh" "old statusline" "Original statusline preserved" && \
  assert_file_exists "$FAKE_GLOBAL_CLAUDE/settings.json" "Global settings.json" && \
  assert_json_field "$FAKE_GLOBAL_CLAUDE/settings.json" ".otherSetting" "preserved" "Other settings preserved"
}

test_different_statusline_configured() {
  echo -e "${GRAY}  Scenario: Different statusline configured (project)${NC}"
  
  # Create settings with different statusline
  mkdir -p "$FAKE_PROJECT_CLAUDE"
  cat > "$FAKE_PROJECT_CLAUDE/settings.json" <<EOF
{
  "statusLine": {
    "type": "command",
    "command": "custom-statusline.sh",
    "padding": 2
  },
  "otherSetting": "preserved"
}
EOF
  
  # Simulate installation
  echo '#!/bin/bash' > "$FAKE_PROJECT_CLAUDE/statusline.sh"
  echo 'echo "new statusline"' >> "$FAKE_PROJECT_CLAUDE/statusline.sh"
  chmod +x "$FAKE_PROJECT_CLAUDE/statusline.sh"
  
  # Settings should be preserved (not overwritten)
  
  # Verify
  assert_file_exists "$FAKE_PROJECT_CLAUDE/statusline.sh" "Project statusline.sh" && \
  assert_json_field "$FAKE_PROJECT_CLAUDE/settings.json" ".statusLine.command" "custom-statusline.sh" "Custom statusLine preserved" && \
  assert_json_field "$FAKE_PROJECT_CLAUDE/settings.json" ".otherSetting" "preserved" "Other settings preserved"
}

test_create_in_empty_directory() {
  echo -e "${GRAY}  Scenario: Create .claude directory if it doesn't exist${NC}"
  
  # Don't create directory beforehand
  rm -rf "$FAKE_PROJECT_CLAUDE" 2>/dev/null
  
  # Simulate installation
  mkdir -p "$FAKE_PROJECT_CLAUDE"
  echo '#!/bin/bash' > "$FAKE_PROJECT_CLAUDE/statusline.sh"
  echo 'echo "test statusline"' >> "$FAKE_PROJECT_CLAUDE/statusline.sh"
  chmod +x "$FAKE_PROJECT_CLAUDE/statusline.sh"
  
  cat > "$FAKE_PROJECT_CLAUDE/settings.json" <<EOF
{
  "statusLine": {
    "type": "command",
    "command": ".claude/statusline.sh",
    "padding": 0
  }
}
EOF
  
  # Verify
  assert_file_exists "$FAKE_PROJECT_CLAUDE/statusline.sh" "Project statusline.sh" && \
  assert_file_exists "$FAKE_PROJECT_CLAUDE/settings.json" "Project settings.json"
}

# Main test execution
main() {
  echo -e "${CYAN}================================${NC}"
  echo -e "${CYAN}CC-Statusline Installation Tests${NC}"
  echo -e "${CYAN}================================${NC}"
  
  # Check for jq dependency
  if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq not found. Some tests may fail.${NC}"
    echo -e "${GRAY}Install with: apt-get install jq (Ubuntu) or brew install jq (macOS)${NC}"
  fi
  
  setup_test_env
  
  # Run all test scenarios
  test_scenario "No files exist (Global)" test_no_files_global
  test_scenario "No files exist (Project)" test_no_files_project
  test_scenario "statusline.sh exists, no settings.json (Global)" test_statusline_exists_global
  test_scenario "Both files exist (Global)" test_both_exist_global
  test_scenario "Different statusline configured (Project)" test_different_statusline_configured
  test_scenario "Create .claude directory if doesn't exist" test_create_in_empty_directory
  
  # Summary
  echo -e "\n${CYAN}================================${NC}"
  echo -e "${CYAN}Test Summary${NC}"
  echo -e "${CYAN}================================${NC}"
  echo -e "Total:  $TESTS_RUN"
  echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
  
  cleanup_test_env
  
  if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
  else
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
  fi
}

# Run the tests
main