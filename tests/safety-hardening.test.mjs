// Safety guards for LOCAL-OVERRIDES.md §7. These read the skill text an agent
// follows, so they pin the instruction contract (who may write, what a denied
// read means, when a loop stops), not how a model behaves when it reads it.
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
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

// Runs the fallback's own review-comment command with the real `gh` against a loopback fake
// of GitHub's REST pagination: 30 comments per page unless `per_page` asks for more, at most
// 100, and a `Link: rel="next"` header while pages remain. GH_HOST=github.localhost makes gh
// speak plain http, and HTTP_PROXY sends every request to the fake, so nothing leaves the
// machine. The token is fake, GH_CONFIG_DIR is a throwaway dir, and the child gets no HOME, so
// no account config is read; GH_TELEMETRY=0 keeps gh from writing a device-id into the working
// directory. This proves the documented command returns every comment, not that an agent reads
// them all.
test.skipIf(!Bun.which("gh"))("babysit.review-comments-complete: the gh fallback returns every page of review comments (skipped without gh)", async () => {
  const reviewLine = section(babysit, "## Steps").split("\n").find((line) => /Review comments/.test(line)) ?? "";
  const command = reviewLine.match(/`(gh api [^`]*\/pulls\/<number>\/comments)`/)?.[1] ?? "";
  expect(command).toContain("repos/{owner}/{repo}/pulls/<number>/comments");

  const total = 130;
  const requests = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://api.github.localhost");
    requests.push({ method: req.method, path: url.pathname, page: url.searchParams.get("page") ?? "1" });
    if (req.method !== "GET" || url.pathname !== "/repos/o/r/pulls/7/comments") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Not Found" }));
      return;
    }
    const perPage = Math.min(Number(url.searchParams.get("per_page") ?? 30), 100);
    const page = Number(url.searchParams.get("page") ?? 1);
    const next = page * perPage < total ? { link: `<http://api.github.localhost${url.pathname}?per_page=${perPage}&page=${page + 1}>; rel="next"` } : {};
    const comments = Array.from({ length: total }, (_, i) => ({ id: i + 1, body: `review comment ${i + 1}` }));
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...next });
    res.end(JSON.stringify(comments.slice((page - 1) * perPage, page * perPage)));
  });
  await new Promise((listening) => server.listen(0, "127.0.0.1", listening));
  const config = mkdtempSync(join(tmpdir(), "babysit-gh-"));
  try {
    const gh = Bun.spawn([Bun.which("gh"), ...command.replace("<number>", "7").split(/\s+/).slice(1)], {
      env: {
        PATH: process.env.PATH ?? "",
        GH_CONFIG_DIR: config,
        GH_HOST: "github.localhost",
        GH_REPO: "github.localhost/o/r",
        GH_TOKEN: "fake-token",
        HTTP_PROXY: `http://127.0.0.1:${server.address().port}`,
        GH_NO_UPDATE_NOTIFIER: "1",
        GH_TELEMETRY: "0",
        GH_PROMPT_DISABLED: "1",
        NO_COLOR: "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exit] = await Promise.all([new Response(gh.stdout).text(), new Response(gh.stderr).text(), gh.exited]);
    expect({ exit, stderr }).toEqual({ exit: 0, stderr: "" });
    // Without --slurp, gh prints each page as its own JSON array, back to back.
    const ids = JSON.parse(`[${stdout.trim().replace(/\]\s*\[/g, "],[")}]`).flat().map((comment) => comment.id);
    expect(ids.length).toBe(total);
    expect(new Set(ids).size).toBe(total);
    expect(requests.every((request) => request.method === "GET")).toBe(true);
    expect(requests.map((request) => request.page)).toContain("2");
  } finally {
    server.close();
    rmSync(config, { recursive: true, force: true });
  }
}, 20000);

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
