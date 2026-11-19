#!/usr/bin/env bash
# Starts the MarkItDown MCP server (stdio) from this repo's .venv, so Claude Code or any
# MCP-capable agent can call convert_to_markdown(uri) on files, web pages and data: URIs.
# Install it first with: npm run setup:py:extras
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT/.venv/bin/markitdown-mcp"
if [ ! -x "$BIN" ]; then
  echo "markitdown-mcp is not installed. Run: npm run setup:py:extras" >&2
  exit 1
fi
exec "$BIN" "$@"
