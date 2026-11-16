# pstack for DeepSeek Harness

The DeepSeek Harness (DSH) tree of pstack, generated from `pstack/`. It ships every pstack skill, plus the `pstack-adapter` skill that maps Cursor names to DSH. The [Cursor edition](https://github.com/cursor/plugins/tree/main/pstack) carries the full introduction.

Each bundle is self-contained. DSH installs all bundles into one flat root, so a skill that reached above its own folder would break, and the tree links anything outside itself to GitHub instead.

## Install

DSH discovers skills one level below a root, as `<root>/<name>/SKILL.md`, so this tree's `skills/` directory is already a root.

Copy the bundles into the user root, which every session reads:

```sh
mkdir -p ~/.dsh/skills
cp -R skills/* ~/.dsh/skills/
```

On Windows, copy `skills/*` into `%USERPROFILE%\.dsh\skills\`. For one repository instead, copy them into `<repo>/.dsh/skills/`. A profile whose `@deepseek-ai/dsh-skill-filesystem` row sets `customSkillDirs` can point at this `skills/` directory and skip the copy.

Restarting is not needed. Discovery watches the roots, so the next session catalog lists the skills.

## Use it

Load the `pstack-adapter` skill once per session before following a pstack skill. It maps Cursor tool names to DSH and lists what DSH does not have. Then start a task with `/poteto-mode`, or call the skill that fits.

The guide is not part of this tree, because DSH installs bundles into a flat root and a bundle cannot reach outside itself. A link to the guide opens on GitHub. Its first page installs the Cursor edition; use the steps above for DSH.

## What differs from the Cursor tree

- **Every skill is model-invocable.** The Cursor tree sets `disable-model-invocation: true` on all but `setup-pstack`, because a person picks it from a menu. DSH routes through the `skill` tool, and that tool refuses a skill the catalog hides, so the flag would hide every routed skill from its only caller. The cost is one catalog entry per skill at session start.
- **`icon` and `color` are dropped.** They describe Cursor's own UI.
- **The adapter is a skill.** `pstack-adapter` carries the mapping table, so every skill can point at it wherever the tree is installed.
- **The agents are skills too.** `poteto-agent` and `comment-sicko` are bundles a delegate loads, because DSH has no agent types.
- **Role models live in `$DSH_HOME/AGENTS.md`.** DSH loads that file into every session, so it replaces `~/.cursor/rules/pstack-models.mdc`.
