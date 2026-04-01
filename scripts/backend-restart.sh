#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

KEEP_INFRA=0
CLEAN_FLAG="--clean"

for arg in "$@"; do
  case "$arg" in
    --keep-infra)
      KEEP_INFRA=1
      ;;
    --clean)
      CLEAN_FLAG="--clean"
      ;;
    --no-clean)
      CLEAN_FLAG="--no-clean"
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: ./scripts/backend-restart.sh [--keep-infra] [--clean|--no-clean]"
      exit 1
      ;;
  esac
done

if [[ "$KEEP_INFRA" -eq 1 ]]; then
  "$ROOT/scripts/backend-down.sh" --keep-infra
else
  "$ROOT/scripts/backend-down.sh"
fi

"$ROOT/scripts/backend-up.sh" "$CLEAN_FLAG"
