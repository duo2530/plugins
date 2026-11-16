# pstack harness trees

This folder is generated from `pstack/skills`, `pstack/agents`, `pstack/docs/guide`, the `pstack/docs/harness/` adapters, `pstack/README.md`, `pstack/LICENSE`, and `pstack/plugin.json`. Do not edit it by hand.

Cursor uses `pstack/` directly. Claude Code installs `claude-code/`, and DeepSeek Harness reads `dsh/`. Each tree carries its own adapter from Cursor names to that harness. The trees leave out the rest of `pstack/`, such as `pstack/automations` and `pstack/assets`. A relative link to a pstack file that a tree leaves out points at that file on GitHub `main` instead.

After editing those sources, run `node scripts/generate-pstack-harness-trees.mjs` from the repository root and commit the result.
