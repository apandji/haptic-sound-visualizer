#!/usr/bin/env bash
# Opens an interactive sqlite3 session against the workspace copy of 7643ha.db.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec sqlite3 "${ROOT}/7643ha.db"
