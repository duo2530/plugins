#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PSTACK = join(ROOT, "pstack");
const SKILLS = join(PSTACK, "skills");
// Outside pstack/ so Cursor, which copies the whole plugin folder, does not install these trees too.
const OUT = join(ROOT, "harness", "pstack");
const GUIDE = "docs/guide";
const ADAPTERS = "docs/harness";
const MANIFESTS = ["plugin.json", ".claude-plugin/plugin.json"];
const COMMAND = "node scripts/generate-pstack-harness-trees.mjs";
const GITHUB = "https://github.com/cursor/plugins";
const LINK = /\]\(([^)\s]+)\)/g;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// `dsh-tool-skill` truncates a catalog description at this length, so a longer one routes on a cut sentence.
const CATALOG_DESCRIPTION_MAX = 500;

const README = `# pstack harness trees

This folder is generated from \`pstack/skills\`, \`pstack/agents\`, \`pstack/${GUIDE}\`, the \`pstack/${ADAPTERS}/\` adapters, \`pstack/README.md\`, \`pstack/LICENSE\`, and \`pstack/plugin.json\`. Do not edit it by hand.

Cursor uses \`pstack/\` directly. Claude Code installs \`claude-code/\`, and DeepSeek Harness reads \`dsh/\`. Each tree carries its own adapter from Cursor names to that harness. The trees leave out the rest of \`pstack/\`, such as \`pstack/automations\` and \`pstack/assets\`. A relative link to a pstack file that a tree leaves out points at that file on GitHub \`main\` instead.

After editing those sources, run \`${COMMAND}\` from the repository root and commit the result.
`;

const DSH_README = `# pstack for DeepSeek Harness

The DeepSeek Harness (DSH) tree of pstack, generated from \`pstack/\`. It ships every pstack skill, the guide, and the [DSH adapter](./${ADAPTERS}/dsh.md). The [Cursor edition](https://github.com/cursor/plugins/tree/main/pstack) carries the full introduction.

## Install

DSH discovers skills one level below a root, as \`<root>/<name>/SKILL.md\`, so this tree's \`skills/\` directory is already a root.

Copy the bundles into the user root, which every session reads:

\`\`\`sh
mkdir -p ~/.dsh/skills
cp -R skills/* ~/.dsh/skills/
\`\`\`

On Windows, copy \`skills/*\` into \`%USERPROFILE%\\.dsh\\skills\\\`. For one repository instead, copy them into \`<repo>/.dsh/skills/\`. A profile whose \`@deepseek-ai/dsh-skill-filesystem\` row sets \`customSkillDirs\` can point at this \`skills/\` directory and skip the copy.

Restarting is not needed. Discovery watches the roots, so the next session catalog lists the skills.

## Use it

Read [\`${ADAPTERS}/dsh.md\`](./${ADAPTERS}/dsh.md) once per session before following a pstack skill. It maps Cursor tool names to DSH and lists what DSH does not have. Then start a task with \`/poteto-mode\`, or call the skill that fits.

The guide's first page installs the Cursor edition. Use the steps above for DSH; the rest of the guide applies as written.

## What differs from the Cursor tree

- **Every skill is model-invocable.** The Cursor tree sets \`disable-model-invocation: true\` on all but \`setup-pstack\`, because a person picks it from a menu. DSH routes through the \`skill\` tool, and that tool refuses a skill the catalog hides, so the flag would hide every routed skill from its only caller. The cost is one catalog entry per skill at session start.
- **\`icon\` and \`color\` are dropped.** They describe Cursor's own UI.
- **The agents are reference briefs.** \`agents/poteto-agent.md\` and \`agents/comment-sicko.md\` stay as files, because DSH has no agent types. The adapter says what to paste into a \`subagent\` prompt.
- **Role models live in \`$DSH_HOME/AGENTS.md\`.** DSH loads that file into every session, so it replaces \`~/.cursor/rules/pstack-models.mdc\`.
`;

const HARNESSES = [
  {
    tree: "claude-code",
    adapter: `${ADAPTERS}/claude-code.md`,
    line:
      "In Claude Code, read [the Claude Code adapter](../../docs/harness/claude-code.md) once per session before you follow this skill. " +
      "It maps the Cursor names in pstack skills to Claude Code.",
    manifests: true,
    sourceReadme: true,
  },
  {
    tree: "dsh",
    adapter: `${ADAPTERS}/dsh.md`,
    line:
      "In DSH, read [the DSH adapter](../../docs/harness/dsh.md) once per session before you follow this skill. " +
      "It maps the Cursor names in pstack skills to DeepSeek Harness.",
    readme: DSH_README,
    dsh: true,
  },
];

const TERMS = [
  { key: "`Task`", re: /`Task`|\bTask (tool|subagent|call)/ },
  { key: "`AskQuestion`", re: /AskQuestion/ },
  { key: "todolist", re: /\btodo ?list\b/i },
  { key: "generalPurpose", re: /generalPurpose/ },
  { key: "poteto-agent", re: /poteto-agent/ },
  { key: "comment-sicko", re: /comment-sicko/ },
  { key: "`readonly: true`", re: /readonly: (true|false)|readonly\/Ask/ },
  { key: "`environment: \"cloud\"`", re: /environment: "(cloud|local)"/ },
  { key: "cloud_base_branch", re: /cloud_base_branch/ },
  { key: "`run_in_background: true`", re: /run_in_background/ },
  { key: "`resume`", re: /`resume`/ },
  { key: "`file_attachments`", re: /file_attachments/ },
  { key: "claude-", re: /\bclaude-[a-z]+-\d/ },
  { key: "grok-", re: /\bgrok-\d/ },
  { key: "gpt-", re: /\bgpt-\d/ },
  { key: "inherit-parent", re: /inherit-parent/ },
  { key: "pstack-models.mdc", re: /pstack-models\.mdc/ },
  { key: ".cursor/skills/", re: /\.cursor\/skills/ },
  { key: "~/.cursor/plugins/", re: /\.cursor\/plugins|\.cursor-plugin/ },
  { key: ".cursor/rules/", re: /\.cursor\/rules|always-applied rule/ },
  { key: "agent-transcripts", re: /agent-transcripts|\.cursor\/projects/ },
  { key: "Cursor-only features", re: /Bugbot|Cursor [Aa]utomation|cursor\.(sh|com)\/automations|[Cc]loud [Aa]gent|built-in PR tool/ },
];
const ROUTE_KEY = "Run another pstack skill";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store" || name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function file(path) {
  return { bytes: readFileSync(path), executable: (statSync(path).mode & 0o111) !== 0 };
}

function text(bytes) {
  return bytes.toString("utf8").replace(/\r\n/g, "\n");
}

// Paths stay POSIX-shaped so the same keys work on Windows and in CI.
function key(root, path) {
  return relative(root, path).split(sep).join("/");
}

const skills = readdirSync(SKILLS).filter((name) => existsSync(join(SKILLS, name, "SKILL.md")));

function classify(skill) {
  const dir = join(SKILLS, skill);
  const others = skills.filter((name) => name !== skill).join("|");
  const route = new RegExp(`the \\*\\*(?<bold>${others})\\*\\* skill|\`/(?<command>${others})\``, "g");
  const linksToSkill = (line, name) => line.includes(`(../${name}/`);
  const namesBareSkill = (line) =>
    [...line.matchAll(route)].some(({ groups }) => !linksToSkill(line, groups.bold ?? groups.command));
  const usesCursorNames = new Set();
  for (const path of walk(dir).filter((path) => path.endsWith(".md"))) {
    const source = text(readFileSync(path));
    for (const term of TERMS) if (term.re.test(source)) usesCursorNames.add(term.key);
    if (source.split("\n").some(namesBareSkill)) usesCursorNames.add(ROUTE_KEY);
  }
  const source = text(readFileSync(join(dir, "SKILL.md")));
  const wrap = usesCursorNames.size > 0 && /^# /m.test(source);
  return { usesCursorNames, wrap };
}

const classes = new Map(skills.map((skill) => [skill, classify(skill)]));
const problems = [];
const users = new Map();
for (const [skill, { usesCursorNames, wrap }] of classes) {
  if (usesCursorNames.size > 0 && !wrap) problems.push(`skills/${skill}/SKILL.md uses Cursor names but has no H1`);
  for (const key of usesCursorNames) users.set(key, [...(users.get(key) ?? []), skill]);
  // Cursor runs a skill by its folder name and every harness lists it by its frontmatter `name`, so the two must match. The Agent Skills spec limits both to SKILL_NAME.
  const frontmatter = text(readFileSync(join(SKILLS, skill, "SKILL.md"))).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const name = frontmatter.match(/^name:(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  if (name !== skill) problems.push(`skills/${skill}/SKILL.md has name ${JSON.stringify(name ?? "")}, not its folder name ${skill}`);
  if (!SKILL_NAME.test(skill) || skill.length > 64) problems.push(`skills/${skill} is not lowercase words joined by hyphens, at most 64 characters`);
}
// A skill may use a Cursor name only if every adapter says what that name becomes in its harness.
const adapters = new Map(HARNESSES.map((harness) => [harness.tree, text(readFileSync(join(PSTACK, harness.adapter)))]));
for (const [key, using] of users) {
  for (const harness of HARNESSES) {
    if (!adapters.get(harness.tree).includes(key)) problems.push(`The ${harness.tree} adapter has no row for ${key}, used by ${using.join(", ")}`);
  }
}
for (const problem of problems) console.log(`FAIL ${problem}`);
if (problems.length > 0) process.exit(1);

// The pstack-relative path that a relative link in `from` points at, if that path exists.
function resolve(from, href) {
  const target = href.replace(/[#?].*/, "");
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined;
  const path = posix.join(posix.dirname(from), target).replace(/\/$/, "");
  return existsSync(join(PSTACK, path)) ? path : undefined;
}

function has(files, path) {
  return files.has(path) || [...files.keys()].some((key) => key.startsWith(`${path}/`));
}

// Cursor's own UI keys, and the invocation flag that would hide the skill from the `skill` tool.
const DSH_DROP = /^(?:color|disable-model-invocation|icon):/;

function stripDshFrontmatter(source) {
  const lines = source.split("\n");
  if (lines[0] !== "---") return source;
  const end = lines.indexOf("---", 1);
  if (end < 0) return source;
  return ["---", ...lines.slice(1, end).filter((line) => !DSH_DROP.test(line)), "---", ...lines.slice(end + 1)].join("\n");
}

// `dsh-skill-filesystem` drops a bundle whose name, description, or invocation value it cannot read, and `dsh-tool-skill` never sees a skill that `disable-model-invocation` hides.
function checkDshSkill(path, source) {
  const skill = path.split("/")[1];
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const field = (key) => frontmatter.match(new RegExp(`^${key}:(.*)$`, "m"))?.[1].trim() ?? "";
  if (!frontmatter) return [`${path} has no frontmatter`];
  const found = [];
  if (field("name") !== skill) found.push(`${path} has name ${JSON.stringify(field("name"))}, not its folder name ${skill}`);
  const description = field("description");
  if (!description) found.push(`${path} has no description`);
  if (description.length > CATALOG_DESCRIPTION_MAX) {
    found.push(`${path} has a ${description.length}-character description, over the ${CATALOG_DESCRIPTION_MAX}-character catalog bound`);
  }
  for (const line of frontmatter.split("\n")) {
    if (DSH_DROP.test(line)) found.push(`${path} keeps the Cursor-only frontmatter line ${JSON.stringify(line)}`);
  }
  return found;
}

function render(harness) {
  const copies = [...walk(SKILLS), ...walk(join(PSTACK, "agents")), ...walk(join(PSTACK, GUIDE)), join(PSTACK, harness.adapter)];
  if (harness.sourceReadme) copies.push(join(PSTACK, "README.md"));
  const files = new Map(copies.map((path) => [key(PSTACK, path), file(path)]));
  if (harness.readme) files.set("README.md", { bytes: Buffer.from(harness.readme), executable: false });
  files.set("LICENSE", file(join(PSTACK, "LICENSE")));
  if (harness.manifests) for (const manifest of MANIFESTS) files.set(manifest, file(join(PSTACK, "plugin.json")));

  for (const [skill, { wrap }] of classes) {
    const path = `skills/${skill}/SKILL.md`;
    const entry = files.get(path);
    let source = text(entry.bytes);
    if (harness.dsh) source = stripDshFrontmatter(source);
    if (wrap) source = source.replace(/^(# .*)\n+/m, `$1\n\n${harness.line}\n\n`);
    entry.bytes = Buffer.from(source);
  }
  for (const [path, entry] of files) {
    if (!path.endsWith(".md")) continue;
    const source = text(entry.bytes).replace(LINK, (link, href) => {
      const target = resolve(path, href);
      if (!target || target.split("/")[0] === ".." || has(files, target)) return link;
      const kind = statSync(join(PSTACK, target)).isDirectory() ? "tree" : "blob";
      return `](${GITHUB}/${kind}/main/pstack/${target}${href.slice(href.search(/[#?]|$/))})`;
    });
    entry.bytes = Buffer.from(source);
  }
  return files;
}

// Each tree ships only its own files, so a relative link that works from pstack/ has to work inside the tree too.
// Links to pstack files that the tree leaves out already point at GitHub, so a failure here is a link that leaves pstack/.
const rendered = new Map([["README.md", { bytes: Buffer.from(README), executable: false }]]);
const dangling = [];
for (const harness of HARNESSES) {
  const files = render(harness);
  for (const [path, entry] of files) {
    rendered.set(`${harness.tree}/${path}`, entry);
    if (!path.endsWith(".md")) continue;
    for (const [, href] of text(entry.bytes).matchAll(LINK)) {
      const target = resolve(path, href);
      if (target && !has(files, target)) dangling.push(`harness/pstack/${harness.tree}/${path} links to ${href}, which is not in the tree`);
    }
  }
  if (!harness.dsh) continue;
  // DSH discovers one level deep and silently skips what it cannot parse, so assert the shape it needs.
  for (const path of files.keys()) {
    if (path.endsWith("SKILL.md") && !/^skills\/[^/]+\/SKILL\.md$/.test(path)) {
      problems.push(`harness/pstack/dsh/${path} is nested, and DSH discovery does not descend`);
    }
  }
  for (const [path, entry] of files) {
    if (/^skills\/[^/]+\/SKILL\.md$/.test(path)) problems.push(...checkDshSkill(path, text(entry.bytes)));
  }
  for (const skill of skills) {
    if (!files.has(`skills/${skill}/SKILL.md`)) problems.push(`harness/pstack/dsh/skills/${skill}/SKILL.md is missing`);
  }
}
for (const link of dangling) console.log(`FAIL ${link}`);
for (const problem of problems) console.log(`FAIL ${problem}`);
if (dangling.length > 0 || problems.length > 0) process.exit(1);

function same(want, have, path) {
  if (want.executable !== have.executable) return false;
  if (!path.endsWith(".md")) return want.bytes.equals(have.bytes);
  // A Windows checkout with core.autocrlf=true hands back CRLF; the tree itself is written with LF.
  return text(want.bytes) === text(have.bytes);
}

if (process.argv.includes("--check")) {
  const onDisk = new Map(existsSync(OUT) ? walk(OUT).map((path) => [key(OUT, path), file(path)]) : []);
  const drifted = [...new Set([...rendered.keys(), ...onDisk.keys()])].sort().filter((path) => {
    const [want, have] = [rendered.get(path), onDisk.get(path)];
    return !want || !have || !same(want, have, path);
  });
  for (const path of drifted.slice(0, 20)) console.log(`harness/pstack/${path}`);
  if (drifted.length > 0) {
    console.log(`harness/pstack is out of date. Run \`${COMMAND}\` and commit the result.`);
    process.exit(1);
  }
  console.log("harness/pstack is up to date.");
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [path, { bytes, executable }] of rendered) {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), bytes);
    chmodSync(join(OUT, path), executable ? 0o755 : 0o644);
  }
  const wrapped = [...classes.values()].filter(({ wrap }) => wrap).length;
  console.log(`${skills.length} skills, ${wrapped} SKILL.md files with the adapter line, ${HARNESSES.length} trees`);
}
