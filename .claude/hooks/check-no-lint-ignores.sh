#!/bin/bash
# Checks that edited files don't contain forbidden lint suppression patterns
# Called after Edit/Write tool uses via PostToolUse hook

# Get the file that was just edited from the tool output
FILE_PATH=$(echo "$CLAUDE_TOOL_OUTPUT" | grep -oE '/[^[:space:]]+\.(ts|tsx|js|jsx)' | head -1)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

FOUND_ISSUES=""

# Check for biome-ignore (always forbidden)
if grep -n "biome-ignore" "$FILE_PATH" 2>/dev/null; then
  FOUND_ISSUES="$FOUND_ISSUES\n  - 'biome-ignore' comment found"
fi

# Check for @ts-ignore (always forbidden)
if grep -n "@ts-ignore" "$FILE_PATH" 2>/dev/null; then
  FOUND_ISSUES="$FOUND_ISSUES\n  - '@ts-ignore' comment found"
fi

# Check for 'as any' casting (ALWAYS forbidden, no exceptions)
if grep -n "as any" "$FILE_PATH" 2>/dev/null; then
  FOUND_ISSUES="$FOUND_ISSUES\n  - 'as any' casting found (ABSOLUTELY FORBIDDEN)"
fi

# Check for @ts-expect-error in non-test files (allowed in tests only)
IS_TEST_FILE=$(echo "$FILE_PATH" | grep -E '\.test\.|\.spec\.|__tests__')
if [ -z "$IS_TEST_FILE" ]; then
  if grep -n "@ts-expect-error" "$FILE_PATH" 2>/dev/null; then
    FOUND_ISSUES="$FOUND_ISSUES\n  - '@ts-expect-error' in non-test file (only allowed in tests)"
  fi
fi

if [ -n "$FOUND_ISSUES" ]; then
  echo ""
  echo "==============================================================================="
  echo "                    FORBIDDEN PATTERN DETECTED"
  echo "==============================================================================="
  echo ""
  echo "File: $FILE_PATH"
  echo ""
  echo "Issues found:"
  echo -e "$FOUND_ISSUES"
  echo ""
  echo "Fix the underlying issue instead of suppressing it."
  echo ""
  exit 1
fi

exit 0
