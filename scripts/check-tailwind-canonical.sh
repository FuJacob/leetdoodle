#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/frontend/src"

# Disallow non-canonical arbitrary color syntax like:
# text-[color:var(--token)]
# Prefer canonical Tailwind v4 syntax:
# text-(--token)
PATTERN='(text|bg|border|ring|fill|stroke)-\[color:var\(--[a-z0-9-]+\)\]'

if rg -n --pcre2 "$PATTERN" "$TARGET_DIR" -g'*.tsx' -g'*.ts'; then
  echo
  echo "Found non-canonical Tailwind color variable classes."
  echo "Use canonical syntax like text-(--token), bg-(--token), border-(--token)."
  exit 1
fi

exit 0
