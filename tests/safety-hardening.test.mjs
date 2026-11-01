// Safety guards for LOCAL-OVERRIDES.md §7. These read the skill text an agent
// follows, so they pin the instruction contract (who may write, what a denied
// read means, when a loop stops), not how a model behaves when it reads it.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const read = (rel) => readFileSync(join(root, "plugins/pstack/skills", rel), "utf8");
const why = read("why/SKILL.md");
const investigator = read("why/references/investigator-prompt.md");
const babysit = read("babysit/SKILL.md");

// A heading's section runs to the next heading of the same or a higher level, so a
// `## Step` section includes its `###` subsections.
function section(text, heading) {
  const level = heading.match(/^#+/)[0].length;
  const lines = text.split("\n");
  const start = lines.indexOf(heading);
  if (start < 0) return "";
  const end = lines.findIndex((line, i) => i > start && /^#+ /.test(line) && line.match(/^#+/)[0].length <= level);
  return lines.slice(start, end < 0 ? lines.length : end).join("\n");
}

test("why.read-only-spawns: investigators and the synthesizer are spawned read-only", () => {
  expect(why).not.toMatch(/readonly:\s*false/);
  expect(why).not.toMatch(/do not use read-?only/i);
  expect(why).toMatch(/`readonly: true`/);
  expect(investigator).toMatch(/you are read-only/i);
});

test("why.copilot-fallback-closed: the Copilot MCP fallback does not widen an investigator", () => {
  // copilot-tools.md (generated provider mapping, not edited here) sends a read-only role
  // that needs MCP to `general-purpose`; why must override that for its own spawns.
  const rule = why.split("\n").find((line) => /Copilot/.test(line) && /general-purpose/.test(line)) ?? "";
  expect(rule).toMatch(/does not apply/);
  expect(rule).toMatch(/read-only/);
});

test("why.denied-read-stays-denied: no privilege change routes around a denied read", () => {
  // The rule must reach both readers: the orchestrating session and each investigator.
  for (const text of [why, investigator]) {
    const denial = text.split("\n").find((line) => /denied/i.test(line)) ?? "";
    expect(denial).toMatch(/never retr|do not retry/i);
  }
  expect(why).toMatch(/do not widen/i);
});

test("why.scoped-fanout: a simple question does not require every category", () => {
  const step3 = section(why, "## Step 3. Spawn Parallel Investigators");
  expect(step3.length).toBeGreaterThan(0);
  expect(step3).not.toMatch(/default to the full parallel investigation/i);
  expect(step3).not.toMatch(/all seven/i);
  expect(step3).not.toMatch(/one investigator per category that has a matching MCP/);
  expect(step3).toMatch(/answer inline/i);
  expect(step3).toMatch(/source control is always searched/i);
  // The inline path must end the run before discovery and dispatch, and nothing later may
  // re-impose a spawn: the roster entry and the synthesizer apply only to a fan-out.
  const inline = step3.split("\n").find((line) => /answer inline/i.test(line)) ?? "";
  expect(step3.indexOf(inline)).toBeLessThan(step3.indexOf("### Discovery"));
  expect(inline).toMatch(/skip|stop|end here|no investigators/i);
  expect(why).not.toMatch(/Always spawn/);
  const step4 = section(why, "## Step 4. Synthesize");
  expect(step4).not.toMatch(/^Spawn one synthesizer\./m);
  expect(step4).toMatch(/when (you )?spawned investigators|after a fan-out|if investigators ran/i);
});

test("why.explicit-unknowns: unsearched categories are reported, with confidence kept", () => {
  expect(why).toMatch(/Sources Consulted/);
  expect(why).toMatch(/What We Don't Know/);
  expect(why).toMatch(/do not rewrite the confidence language/);
  expect(why).toMatch(/references\/epistemics\.md/);
  const output = section(why, "## Output Format");
  // Upstream already lists skipped investigators; the candidate lists unselected categories.
  expect(output).toMatch(/one line per (investigator|evidence category)/);
  expect(output).toMatch(/skipped|not searched|not selected/);
});

test("why.generated-sections: role lines stay generator-owned", () => {
  const models = section(why, "## Models");
  expect(models).toMatch(/- why investigators: `[^`]+`/);
  expect(models).toMatch(/- why synthesizer: `[^`]+`/);
  expect(section(why, "## Reasoning effort").length).toBeGreaterThan(0);
});

test("babysit.single-owner: an installed babysit-pr watcher owns the PR", () => {
  expect(babysit).toMatch(/`babysit-pr`[^.\n]*installed[^.\n]*use it/i);
  expect(babysit).toMatch(/one continuation owner/i);
  expect(babysit).toMatch(/do not start a second/i);
});

test("babysit.portable-fallback: every sibling skill has a gh-only fallback", () => {
  const steps = section(babysit, "## Steps");
  const uses = steps.split("\n").filter((line) => /\*\*(fix-merge-conflicts|fix-ci|get-pr-comments)\*\*|`loop` skill/.test(line));
  expect(uses.length).toBeGreaterThanOrEqual(4);
  for (const line of uses) expect(line).toMatch(/when (it is )?installed; otherwise/);
});

test("babysit.cap-is-escalation: the round cap reports blocked, never ready", () => {
  const cap = babysit.split("\n").find((line) => /three rounds/.test(line)) ?? "";
  expect(cap).toMatch(/hand control back/);
  expect(cap).toMatch(/blocked, not ready/i);
});

test("babysit.write-scope: forge writes beyond pushes need an explicit request", () => {
  const rules = section(babysit, "## Hard rules");
  expect(rules).toMatch(/covers commits and pushes to that PR's own head branch/);
  expect(rules).toMatch(/explicit request/);
  const ready = rules.split("\n").find((line) => /`gh pr ready`/.test(line) && line.startsWith("- `gh pr ready`")) ?? "";
  expect(ready).toMatch(/user asked/);
  expect(babysit).not.toMatch(/reply with what you would have done/);
  expect(babysit).not.toMatch(/Force-push only if the branch is yours/);
});

test("babysit.kept-guards: no hook bypass, no weakened test, no history rewrite without the user", () => {
  const rules = section(babysit, "## Hard rules");
  expect(rules).toMatch(/Never skip hooks \(`--no-verify`\)/);
  expect(rules).toMatch(/Don't tweak a test's expected values just to get a pass/);
  expect(rules).toMatch(/Never bypass a failing check by marking it as not required/);
  expect(rules).toMatch(/clear it with the user first/);
});
