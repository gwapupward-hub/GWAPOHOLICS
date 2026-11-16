import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const scriptFile = new URL('../scripts/setup-neon-coding-agent.sh', import.meta.url);
const script = readFileSync(scriptFile, 'utf8');
const agentRules = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');

test('persistent coding-agent bootstrap has valid Bash syntax', () => {
  const result = spawnSync('bash', ['-n', scriptFile.pathname], {
    cwd: root.pathname, encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
});

test('setup follows official Neon CLI login and plugin, skills and MCP flow', () => {
  assert.match(script, /npm install -g neon@latest/);
  assert.match(script, /neon --version/);
  assert.match(script, /neon login/);
  assert.match(script, /neon plugins --global --agent/);
  assert.match(script, /neon skills -y --global --agent/);
  assert.match(script, /neon mcp -y --agent/);
  assert.match(script, /Node\.js 22\.20 or newer/);
});

test('agent instructions isolate Preview, production and recovery branches', () => {
  assert.match(agentRules, /square-mode-74279855/);
  assert.match(agentRules, /br-red-star-bc7lzrr0/);
  assert.match(agentRules, /br-billowing-sea-bcx8nhn7/);
  assert.match(agentRules, /br-damp-scene-bc9ep85r/);
  assert.match(agentRules, /No production\/default branch SQL writes/);
  assert.match(agentRules, /No production Vercel deploy/);
});
