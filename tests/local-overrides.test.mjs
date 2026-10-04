// Local-override guards (LOCAL-OVERRIDES.md §5 and §6). The §5 consolidation
// retired sections and skills that other prose still pointed at, and nothing
// failed: a dead `#anchor` or a "see the Principles section" sentence reads
// fine until an agent follows it. These checks make that drift loud, and keep
// an upstream sync from silently reverting the §6 tdd default.
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const skills = join(root, "plugins/pstack/skills");

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules") return [];
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith(".md") ? [path] : [];
  });
}

// GitHub's heading slug: lowercase, drop punctuation other than "-" and "_",
// spaces become hyphens. Duplicate headings get -1, -2 suffixes.
export function headingSlugs(text) {
  const seen = new Map();
  const slugs = new Set();
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const m = !fenced && /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = m[1]
      .replace(/`/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }
  return slugs;
}

export function deadAnchors(files) {
  const dead = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const [, target, anchor] of text.matchAll(/\]\(([^)\s#]*\.md|)#([^)\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      const targetFile = target ? resolve(dirname(file), target) : file;
      let slugs;
      try {
        slugs = headingSlugs(readFileSync(targetFile, "utf8"));
      } catch {
        continue; // missing files are generate.mjs's prose-path check
      }
      if (!slugs.has(anchor)) dead.push(`${relative(root, file)} -> ${target || "(self)"}#${anchor}`);
    }
  }
  return dead;
}

const RETIRED_PROSE = [
  "poteto-mode's Non-negotiables",
  "(Non-negotiables)",
  "through the Non-negotiables",
  "Principles section",
  "Laziness Protocol",
];

describe("local overrides", () => {
  test("the anchor checker recognizes live and dead anchors", () => {
    const slugs = headingSlugs("# Poteto mode\n## Task routing\n```\n## Not a heading\n```\n## Models\n");
    expect([...slugs]).toEqual(["poteto-mode", "task-routing", "models"]);
  });

  test("every in-repo markdown anchor in the skills tree resolves to a heading", () => {
    expect(deadAnchors(markdownFiles(skills))).toEqual([]);
  });

  test("no skill text points at a section or skill §5 retired", () => {
    const hits = markdownFiles(skills).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return RETIRED_PROSE.filter((phrase) => text.includes(phrase)).map((p) => `${relative(root, file)}: ${p}`);
    });
    expect(hits).toEqual([]);
  });

  test("tdd is test-first by default for behavior changes (§6)", () => {
    const text = readFileSync(join(skills, "tdd/SKILL.md"), "utf8");
    const description = /^description:\s*"?(.*?)"?\s*$/m.exec(text)[1];
    expect(description.startsWith("Use only when")).toBe(false);
    expect(description).toMatch(/failing test first/i);
    expect(description).toMatch(/prototype|spike/i);
  });
});
