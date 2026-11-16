# pstack for DeepSeek Harness

The DeepSeek Harness (DSH) tree of pstack, generated from `pstack/`. It ships every pstack skill, the guide, and the [DSH adapter](./docs/harness/dsh.md). The [Cursor edition](https://github.com/cursor/plugins/tree/main/pstack) carries the full introduction.

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

Read [`docs/harness/dsh.md`](./docs/harness/dsh.md) once per session before following a pstack skill. It maps Cursor tool names to DSH and lists what DSH does not have. Then start a task with `/poteto-mode`, or call the skill that fits.

The guide's first page installs the Cursor edition. Use the steps above for DSH; the rest of the guide applies as written.

## What differs from the Cursor tree

- **Every skill is model-invocable.** The Cursor tree sets `disable-model-invocation: true` on all but `setup-pstack`, because a person picks it from a menu. DSH routes through the `skill` tool, and that tool refuses a skill the catalog hides, so the flag would hide every routed skill from its only caller. The cost is one catalog entry per skill at session start.
- **`icon` and `color` are dropped.** They describe Cursor's own UI.
- **The agents are reference briefs.** `agents/poteto-agent.md` and `agents/comment-sicko.md` stay as files, because DSH has no agent types. The adapter says what to paste into a `subagent` prompt.
- **Role models live in `$DSH_HOME/AGENTS.md`.** DSH loads that file into every session, so it replaces `~/.cursor/rules/pstack-models.mdc`.
