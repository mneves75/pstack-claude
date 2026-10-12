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
- `tiers.default` (`opus`), `tiers.strongest` (`fable`) and supported `efforts` follow
  upstream. `defaultEffort` is `xhigh`. Codex execution tiers and panel entries use
  `gpt-6.1-sol`; both OpenAI Pi aliases map to that execution model. Planning and read-only
  advice use the host's dedicated `gpt-6-astra` route at `high`, never an executor alias.

Rule this enforces: Claude models are `opus` or `fable` only. Never Sonnet, never Haiku,
not as a cheap explorer or wrapper.

This override is data, not prose. `tools/generate.mjs` re-stamps every `## Models` section
from it and fails on any stray model slug left in skill bodies, so it survives an
upstream sync. Do not hand-edit model names into skill text. On sync, `models.json`
conflicts only when upstream edits `tiers.panel` or `available`; keep the two-entry lists.

Check: `rg -ni 'sonnet|haiku' plugins/pstack/skills/` must return nothing.

**Known cost of this override.** Codex execution panels share one model. Report reduced
model diversity; independent contexts and distinct review questions do not establish
cross-model independence. A required different-model check is blocked if no permitted
reviewer is available. Do not send implementation or code review to the planning advisor.

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

Sync of 2026-09-29 (upstream 0.9.50): two conflicts in prose and four in adjacent files.
`interrogate` keeps upstream's backticked `Agent` wording with the family list cut to
"Opus or Fable" (§1). Upstream deleted the unread portable copy at
`poteto-mode/references/agents/poteto-agent.md`; the deletion stands, and the wording this
machine changed lives in `agents/poteto-agent.md`, which stamps the effort agents.
`worktree-cleanup.md` keeps the engineering-reference links with upstream's `worktree-audit.mjs`
rename. `automate-me` keeps the sentence without `unslop`. Tests: `models.test.mjs` takes
upstream's new layout with the two-model `available` expectation; `agent-skills.test.mjs`
takes upstream's existence check with `engineering-design.md` in place of the retired
`principle-model-the-domain`; `generate.test.mjs` plants its stray `subagent_type` in `why`
because `unslop` no longer exists. Upstream now runs the generator under Bun
(`bun tools/generate.mjs`), not Node.

Sync of 2026-10-04 (upstream 0.9.67, pin v0.15.9): five textual conflicts, all in prose
the §5 consolidation already rewrote, plus three semantic repairs the tests caught.
`poteto-mode/SKILL.md` keeps the Task routing and "Conditional engineering guidance"
sections; upstream's reworded full-autonomy line ("say in plain words what the operator
could tell you to do instead", no shorthand token) moved into `engineering-coordination.md`,
upstream's `benchmark-checklist` trigger became a Task routing bullet, and the new
`principle-explain-the-number` is retired and folded into `engineering-verification.md`
(`benchmark-checklist` now links there). `agents/poteto-agent.md` takes upstream's
"spawn a fresh agent per task" description with the local "conditional engineering
guidance" wording. `autopilot-full.md` takes upstream's text with the prove-it-works
link rewritten; `hillclimb.md` keeps the verification-guidance link and adds upstream's
benchmark-checklist sentence. `docs/reference.md` keeps the local skill-count wording
(32 public, 0 principle) with upstream's Pi mention.
Repairs: upstream's new `pi.models` table in `models.json` names `sonnet` and `haiku`;
the generator and `parseModels` reject keys outside `available`, so both are dropped from
all three providers (§1), which also re-stamps `pi-tools.md`. The generated `pi models:` grammar example in
`tools/runtimes.mjs` says `fable=` instead of `sonnet=`, so the §1 scan stays empty.
The static `model` tool description in `plugins/pstack/pi/agent-tools.ts` still lists
all four families; it sits outside the §1 scan, and the Pi runtime rejects any alias
not in `available` (`pi/config.ts`). The Pi `package.json`
keywords lose `unslop` to match the plugin manifests (§5). `models.test.mjs` deletes
`fable`, not the dropped `haiku`, in the Pi-table case and pins that `sonnet` cannot
re-enter through the Pi table. Upstream's Pi tests import `typebox` from the root
`bun.lock`; run `bun install --frozen-lockfile` before `bun test`, or 12 Pi tests fail
on pristine upstream too.

Repair of 2026-10-04 (no upstream change): §5 removed poteto-mode's `## Non-negotiables`
and the Principles section, but 7 links and 11 sentences still pointed at them (and at
the retired Laziness Protocol). The driver rule now lives in `## Task routing`, so
`DRIVER_LINE` in `tools/generate.mjs`, the five stamped playbooks, `bug-fix.md`,
`multi-phase-plan.md`, `codex-tools.md`, `pi-tools.md`, `docs/reference.md` and the
`substitutions.json` hints point there; smallest-change wording points at
`engineering-evolution.md`; `figure-it-out` reads the Conditional engineering guidance.
`eval.md`'s own "Non-negotiables for blinding" label is unrelated and stays.
`tests/local-overrides.test.mjs` resolves every in-repo markdown anchor against GitHub
heading slugs and rejects the retired phrases, so the next consolidation fails loudly.

## 6. tdd is test-first for behavior changes (prose, will conflict on sync)

Upstream `tdd` triggers "only when the user explicitly asks for TDD … or when the bug
has an obvious cheap local test target". This machine's contract is tests first, and
Matt Pocock's `implement`/`implement-spec` call `tdd` expecting a test-first loop, so
`plugins/pstack/skills/tdd/SKILL.md` now defaults to writing the failing test first for
any bug fix or feature, and excludes prototypes, spikes, and pure config or wiring.
The impracticality escape hatch stays, but the agent must say why and name the check it
used instead. `tests/local-overrides.test.mjs` fails if the description starts with
"Use only when" again. **Expect a conflict on the next upstream sync of `tdd`**;
re-apply by hand.
