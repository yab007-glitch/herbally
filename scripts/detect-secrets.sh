#!/usr/bin/env bash
# detect-secrets — scan staged files for potential secrets before committing.
# Run: ./scripts/detect-secrets.sh
# Exits non-zero if any potential secrets are found.

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Scanning for potential secrets...${NC}"

# Patterns that look like secrets (high-signal)
PATTERNS=(
  # API keys and tokens
  "sk-[a-zA-Z0-9]{20,}"
  "sk-or-v1-[a-zA-Z0-9]{20,}"
  "sk_test_[a-zA-Z0-9]{20,}"
  "sk_live_[a-zA-Z0-9]{20,}"
  "pk_test_[a-zA-Z0-9]{20,}"
  "pk_live_[a-zA-Z0-9]{20,}"
  "whsec_[a-zA-Z0-9]{20,}"
  "supa_[a-zA-Z0-9]{20,}"
  "eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}" # JWT tokens
  # Generic patterns
  "API[_-]?KEY[=:]\s*['\"]?[a-zA-Z0-9_\-]{16,}"
  "SECRET[=:]\s*['\"]?[a-zA-Z0-9_\-]{16,}"
  "TOKEN[=:]\s*['\"]?[a-zA-Z0-9_\-]{16,}"
  # Connection strings
  "postgres://[^'\"]+@"
  "redis://[^'\"]+@"
  "mongodb://[^'\"]+@"
)

EXCLUDE_DIRS=(
  "node_modules"
  ".next"
  ".git"
  "playwright-report"
  "test-results"
  "coverage"
)

FOUND=0
FILES_TO_SCAN=""

if [ "${1:-}" = "--all" ]; then
  # Scan all tracked files
  FILES_TO_SCAN=$(git ls-files | grep -v "$(printf '%s\n' "${EXCLUDE_DIRS[@]}" | sed 's/.*/\/\.\?\*&\*\/\.\?\*/' | paste -sd '\|' -)" || true)
else
  # Scan staged files (pre-commit)
  FILES_TO_SCAN=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || echo "")
  
  # Fallback: if no staged files, scan all non-excluded files
  if [ -z "$FILES_TO_SCAN" ]; then
    echo -e "${YELLOW}⚠ No staged files found, scanning all tracked files...${NC}"
    FILES_TO_SCAN=$(git ls-files | grep -v 'node_modules\|\.next\|\.git\|playwright-report\|test-results\|coverage' || true)
  fi
fi

if [ -z "$FILES_TO_SCAN" ]; then
  echo -e "${GREEN}✓ No files to scan${NC}"
  exit 0
fi

for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    [ ! -f "$file" ] && continue
    
    # Skip binary files
    if file "$file" 2>/dev/null | grep -q "binary"; then
      continue
    fi
    
    # Skip lock files and build artifacts
    case "$file" in
      *.lock|*.log|*.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.woff*|*.ttf|*.eot|*.otf|*.mp3|*.mp4|*.webm|*.zip|*.tar*|*.gz|*.pack) continue ;;
    esac
    
    if matches=$(grep -nE "$pattern" "$file" 2>/dev/null); then
      # Ignore matches in .env.example (these are placeholders)
      if echo "$file" | grep -q '\.env\.example$'; then
        continue
      fi
      # Ignore matches in test files with placeholder values
      if echo "$file" | grep -q '\.test\.'; then
        if echo "$matches" | grep -q "placeholder\|test_\|example\|REPLACE\|your-"; then
          continue
        fi
      fi
      
      while IFS= read -r match; do
        lineno=$(echo "$match" | cut -d: -f1)
        linecontent=$(echo "$match" | cut -d: -f2-)
        echo -e "${RED}⚠ Potential secret in ${file}:${lineno}${NC}"
        echo -e "   ${linecontent:0:120}"
      done <<< "$matches"
      FOUND=$((FOUND + 1))
    fi
  done <<< "$FILES_TO_SCAN"
done

if [ $FOUND -gt 0 ]; then
  echo ""
  echo -e "${RED}❌ Found $FOUND potential secret(s). Commit blocked.${NC}"
  echo -e "${YELLOW}If these are false positives or intentional placeholders, use:${NC}"
  echo -e "  git commit --no-verify"
  exit 1
fi

echo -e "${GREEN}✓ No secrets detected${NC}"
exit 0
