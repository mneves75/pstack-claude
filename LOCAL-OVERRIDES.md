# Local overrides

Deviations from `michael-denyer/pstack-claude` upstream, applied for this machine.
**Re-apply these after every `git pull` or `tools/sync.mjs` run**, then re-run
`node tools/generate.mjs` and the verification below.

## 1. Model policy — no Sonnet, no Haiku (generator-backed, survives sync)

`plugins/pstack/models.json` uses upstream's tier-alias schema (0.9.40+): roles name a
tier (`default`, `strongest`, `panel`) and each tier resolves to the model aliases the
`Agent` tool accepts (`opus`, `fable`), not versioned `claude-*` slugs.

- `tiers.panel` is `["opus", "fable"]`. Upstream ships a third entry, `sonnet`, used by
  `arena runners`, `arena cross-judge pool`, `architect runners` and `interrogate reviewers`.
- `available` is `["opus", "fable"]`. Upstream also lists `sonnet` and `haiku`; dropping
  them keeps `/setup-pstack` from reintroducing a banned model through the override sheet.
- `tiers.default` (`opus`), `tiers.strongest` (`fable`), `efforts`, `defaultEffort` and
  `codex` follow upstream (`codex.strongest` `gpt-6-astra`, default `gpt-6-sol`, panel
  `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`). The Claude side is two models after the Sonnet
  removal; the GPT arm is what keeps a panel cross-family, which is the entire reason a
  panel exists.

Rule this enforces: Claude models are `opus` or `fable` only. Never Sonnet, never Haiku,
not as a cheap explorer or wrapper.

This override is data, not prose. `tools/generate.mjs` re-stamps every `## Models` section
from it and fails on any stray model slug left in skill bodies, so it survives an
upstream sync. Do not hand-edit model names into skill text. On sync, `models.json`
conflicts only when upstream edits `tiers.panel` or `available`; keep the two-entry lists.

Check: `rg -ni 'sonnet|haiku' plugins/pstack/skills/` must return nothing.

**Known cost of this override.** A panel's value is cross-family disagreement, and the Claude arm
is now two models from one family. `codex.panel` restores diversity on Codex only. On Claude
Code the honest position is that `interrogate`, `arena runners` and `architect runners` run a
same-family panel. The `pstack-models.md` override sheet cannot fix this: its grammar takes
model aliases for the `Agent` tool's `model` parameter, and the GPT rails here are *agents*
reached through `codex-auto`, not model names. Adding a real third arm means editing each
panel skill's dispatch prose, which is a sync conflict per skill. Not done. Decide it against
measured panel quality, not in advance.

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
  still lands in someone else's inbox. That wrapper is retired by §5; the boundary now lives
  in the last paragraph of `poteto-mode/references/engineering-coordination.md`.

These are prose edits inside files `sync.mjs` rewrites, so **expect a conflict on the next
upstream sync of either file** and re-apply by hand.

## 3. Install path — shared skills, not the Claude Code plugin

Installed by symlinking `plugins/pstack/skills/*` into `~/.agents/skills/`, **not** via
`/plugin install pstack@pstack-claude`.

Reason: from 0.9.5 the Claude Code plugin ships a `SessionStart` hook that injects a
poteto-mode routing mandate on startup, `/clear` and post-compact. This machine invokes `poteto-mode` per task and removes automatic persona injection. The shared global contract owns default behavior. The README notes that
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


## 5. Shared-core consolidation (2026-09-12)

The 21 `principle-*` skill wrappers and the always-active `unslop` entrypoint are
retired. Four conditional `poteto-mode/references/engineering-*.md` documents own
the distinctive engineering detail. Caller links, the command generator, and
the static positive-control tests migrate together. Ordinary writing follows the
active global contract; explicit editing uses the installed `no-ai-slop` workflow
when available and otherwise proceeds directly without an unshipped dependency.

Local authorization repairs preserve unresolved constraint comments, prepare
external backlog submissions for approval, and honor already authorized skill
edits. These are intentional behavior changes for the operator's shared-core
setup, not an upstream release. Do not restore retired wrappers during sync.
Run the generator and static tests after reconciling future upstream changes.

Sync of 2026-09-19 (upstream 0.9.35): upstream added `principle-attack-the-premise`
and `principle-test-behavior-not-implementation`; both are retired here and folded
into `engineering-verification.md`, as are the `prove-it-works` rules that
`tests/skill-rules.test.mjs` pins. The driver-skill, platform-skill, and
defect-severity routing rules live in `poteto-mode`'s Task routing. Agent dispatch
follows upstream's `pstack:` namespace (see §3 for how to reach the agents here).
`validatePluginLayout` in `tools/generate.mjs` fails if any `principle-*` skill
reappears; `tests/invariants.test.mjs` proves that check fires.

Sync of 2026-09-25 (upstream 0.9.45): upstream edited 13 retired `principle-*`
wrappers and `unslop` (semicolons split into sentences, a few redundant lines
dropped); none carried new guidance, so the deletions stand. Upstream's new
full-autonomy-grant rule for operator-only calls is folded into
`engineering-coordination.md`, and its "label every claim measured, inferred, or
guess" reply rule into `poteto-mode`'s Writing the reply. The new effort agents
(`effort-agents/poteto-agent-*.md`) are stamped from `agents/poteto-agent.md`, so
they inherit its engineering-reference wording. Caller links in upstream's
reworded playbooks were rewritten again, and three leftover plain-text
"principle skill" mentions (`architect`, its runner prompt, and the
`typescript-best-practices` patterns) now link the references too.
