# Local overrides

Deviations from `michael-denyer/pstack-claude` upstream, applied for this machine.
**Re-apply these after every `git pull` or `tools/sync.mjs` run**, then re-run
`node tools/generate.mjs` and the verification below.

## 1. Model policy — no Sonnet, no Haiku (generator-backed, survives sync)

`plugins/pstack/models.json`:

- `panel` is `["claude-opus-5", "claude-fable-5"]`. Upstream ships a third entry,
  `claude-sonnet-5`, used by `how critics`, `arena runners`, `arena cross-judge pool`,
  `architect runners` and `interrogate reviewers`.
- `available` lists only Opus 5 and Fable 5, so `/setup-pstack` cannot reintroduce a
  banned slug through the override sheet.
- `codex.panelQuad` points at the GPT rails actually reachable here
  (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`) via the `ocx-*` agents or
  `codex-auto`. The Claude side is two models after the Sonnet removal; the GPT arm is what
  keeps a panel cross-family, which is the entire reason a panel exists.

Rule this enforces: Claude models are `opus-5` or `fable-5` only. Never Sonnet, never Haiku,
not as a cheap explorer or wrapper.

This override is data, not prose. `tools/generate.mjs` re-stamps every `## Models` section
from it and fails on any stray `claude-*` slug left in skill bodies, so it survives an
upstream sync. Do not hand-edit model names into skill text.

Check: `rg -ni 'sonnet|haiku' plugins/pstack/skills/` must return nothing.

Also reworded `interrogate`'s `menu-description` from "three different models" to "several",
since the panel is two on the Claude side. That field is hand-written frontmatter, not stamped,
so it will conflict on sync like the prose edits below.

**Known cost of this override.** A panel's value is cross-family disagreement, and the Claude arm
is now two models from one family. `codex.panelQuad` restores diversity on Codex only. On Claude
Code the honest position is that `interrogate`, `how critics`, `arena runners` and
`architect runners` run a same-family panel. The `~/.claude/pstack-models.md` override sheet
cannot fix this: its grammar takes model slugs for the `Agent` tool's `model` parameter, and the
GPT rails here are *agents* (`ocx-gpt-5-6-sol`, `ocx-gpt-5-6-terra`), not slugs. Adding a real
third arm means editing each panel skill's dispatch prose, which is a sync conflict per skill.
Not done. Decide it against measured panel quality, not in advance.

## 2. Autonomy — confirm before anything leaves the machine (prose, will conflict on sync)

Two files hand-edited, because upstream treats "reversible" as the test and this machine
treats *reach* as the test:

- `plugins/pstack/skills/poteto-mode/SKILL.md`, `## Autonomy`. Upstream reads "Reversible work
  and external actions (team chat, ticket updates, kicking off evals) proceed without asking."
  Replaced with local-only autonomy plus an explicit pause before push, deploy, publish, send,
  any external write, credentials, and scope expansion. Also states that a "run until done"
  session override does not authorize an unsanctioned external write.
- `plugins/pstack/skills/principle-never-block-on-the-human/SKILL.md`, `**Boundaries:**`.
  Same split: reach, not reversibility, decides. A ticket comment is trivially deletable and
  still lands in someone else's inbox.

These are prose edits inside files `sync.mjs` rewrites, so **expect a conflict on the next
upstream sync of either file** and re-apply by hand.

## 3. Install path — shared skills, not the Claude Code plugin

Installed by symlinking `plugins/pstack/skills/*` into `~/.agents/skills/`, **not** via
`/plugin install pstack@pstack-claude`.

Reason: from 0.9.5 the Claude Code plugin ships a `SessionStart` hook that injects a
poteto-mode routing mandate on startup, `/clear` and post-compact. This machine already runs
ponytail as an always-on SessionStart hook. Two competing always-on styles injected into every
session is the conflict, so `poteto-mode` is invoked per task instead. The README notes that
deleting `hooks/hooks.json` from an installed plugin copy is undone by the next plugin update,
which is why the plugin path was avoided rather than patched.

Consequences accepted: no native Claude Code subagent registration (dispatch `comment-sicko`
by pointing the Agent tool at `poteto-mode/references/agents/comment-sicko.md`), and Codex
slash-command stubs need linking separately from `.codex-plugin/prompts/`.

## 4. Not installed

`tdd` and `teach` are **not** linked. Both names already exist in `~/.agents/skills/` and in
`~/.claude/skills/` (pointing at `~/.codex/skills/`). `skills-doctor` fails on a duplicate
`name:` inside a farm, which would break skill discovery for Claude Code, Codex and Cursor at
once. The existing skills win; both areas are already covered here.

Graphite-dependent playbooks (`shipping`, `autopilot-stack`, parts of `babysit`) are installed
but unusable: `gt` is not on this machine. Use the local `ship` flow and `mneves-ship-deploy`.
