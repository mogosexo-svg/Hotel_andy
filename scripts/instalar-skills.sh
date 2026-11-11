#!/usr/bin/env bash
# Instala las 4 skills del proyecto en ~/.claude (idempotente). Ver docs/DEATH_NOTE.md.
set -e
mkdir -p ~/.claude/skills
if [ ! -f ~/.claude/skills/impeccable/SKILL.md ]; then
  t=$(mktemp -d); git clone -q --depth 1 https://github.com/pbakaus/impeccable.git "$t/i"
  cp -r "$t/i/.claude/skills/impeccable" ~/.claude/skills/; rm -rf "$t"
fi
npx -y skills add nutlope/hallmark -g --agent claude-code -y < /dev/null > /dev/null
claude plugin marketplace add DietrichGebert/ponytail || true
claude plugin install ponytail@ponytail || true
claude plugin marketplace add worldflowai/everything-claude-code || true
claude plugin install everything-claude-code@everything-claude-code || true
npm i -g puppeteer-core > /dev/null
ln -sf /opt/pw-browsers/chromium /usr/bin/chromium
echo "skills OK"
