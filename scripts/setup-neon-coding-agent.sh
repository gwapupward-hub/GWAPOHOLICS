#!/usr/bin/env bash
# Set up the Neon CLI, authenticated browser sign-in, agent skills and MCP
# in the persistent developer environment running Claude Code or Codex.
# Never run this in a disposable ChatGPT tool container and claim it persists.
set -Eeuo pipefail

AGENT_ID="${NEON_AGENT:-claude-code}"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "ERROR: Node.js and npm are required in this coding-agent environment." >&2
  exit 1
fi

if ! node -e 'const [major,minor]=process.versions.node.split(".").map(Number); process.exit(major>22||(major===22&&minor>=20)?0:1)'; then
  echo "ERROR: Neon agent skills setup requires Node.js 22.20 or newer." >&2
  echo "Upgrade Node.js in your persistent Codespaces/coding-agent terminal, then rerun." >&2
  exit 1
fi

echo "Installing the current official Neon CLI..."
npm install -g neon@latest
neon --version

echo
echo "About to open Neon browser sign-in."
echo "Only the account owner should authorize this login. Do not paste credentials in the terminal or chat."
neon login

echo
echo "Installing Neon skills and MCP for agent: ${AGENT_ID}"
if ! neon plugins --global --agent "${AGENT_ID}" -y; then
  echo "Combined Neon plugin installation unavailable; trying skills and MCP separately..."
  neon skills -y --global --agent "${AGENT_ID}"
  neon mcp -y --agent "${AGENT_ID}"
fi

cat <<'END_SETUP'
Neon Agent Setup Complete
-------------------------------------------
✓ CLI installed
✓ Signed in
✓ Neon skills and MCP server installed

Restart the coding agent to load the skills and MCP server.
For Claude Code, run /reload-plugins when supported.

Never store database connection URLs or Neon API keys in this repository.
END_SETUP
