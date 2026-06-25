#!/usr/bin/env bash
# Generate a study pepper for participant HMAC lookup (keep secret, never commit).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/.study_pepper"

if [[ -f "$OUT" ]]; then
  echo "Already exists: $OUT (delete first to regenerate)" >&2
  exit 1
fi

python3 -c "import secrets; print(secrets.token_hex(32))" > "$OUT"
chmod 600 "$OUT"
echo "Created $OUT (chmod 600). Back up securely; do not commit to git."
