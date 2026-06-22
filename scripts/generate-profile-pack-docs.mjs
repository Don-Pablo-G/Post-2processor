#!/usr/bin/env node
// Generates PROFILE_PACKS.md from the per-pack ProfileRuleDoc registries.
//
// For every pack we:
//   1. Import its `*RuleDocs` registry + the pack's `validateAst` profile.
//   2. Run the pack's `validateAst` on each rule's `positiveSnippet` and
//      `negativeSnippet`, asserting the matcher fires (positive) and does not
//      fire (negative). Mismatches abort with exit code 1 — keeping the docs
//      and the rules in lock-step on every PR.
//   3. Emit one section per pack with one row per rule.
//
// Wired into the root `verify` chain via `npm run docs:profile-packs`. Requires
// the workspace packages to be built first (so `@cnc/core` and the profile
// packs resolve to their `dist/` entries via the workspace symlink).

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "@cnc/core";
import { haasNgcProfile, haasNgcRuleDocs } from "@cnc/profile-haas-ngc";
import { fanucIsoProfile, fanucIsoRuleDocs } from "@cnc/profile-fanuc-iso";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const PACKS = [
  {
    name: "Haas NGC",
    packageName: "@cnc/profile-haas-ngc",
    profile: haasNgcProfile,
    rules: haasNgcRuleDocs
  },
  {
    name: "Fanuc ISO",
    packageName: "@cnc/profile-fanuc-iso",
    profile: fanucIsoProfile,
    rules: fanucIsoRuleDocs
  }
];

function escapeCell(value) {
  // Markdown table cells must not contain raw newlines or pipes; we render
  // multiline snippets in their own fenced code block below the row.
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function snippetFence(snippet) {
  return ["```gcode", snippet.replace(/\r?\n$/, ""), "```"].join("\n");
}

function verifyRule(profile, rule) {
  const validate = profile.validateAst;
  if (typeof validate !== "function") {
    throw new Error(`Profile "${profile.id}" has no validateAst — cannot verify ${rule.id}`);
  }

  const positiveAst = parse(rule.positiveSnippet, profile);
  const positiveIssues = validate(positiveAst);
  const positiveMatches = positiveIssues.filter((i) => rule.messageMatcher.test(i.message));
  if (positiveMatches.length === 0) {
    throw new Error(
      `[${profile.id}/${rule.id}] positiveSnippet did NOT trigger ${rule.messageMatcher}.\n` +
        `Actual messages: ${positiveIssues.map((i) => i.message).join(" | ") || "<none>"}`
    );
  }
  for (const issue of positiveMatches) {
    if (issue.severity !== rule.severity) {
      throw new Error(
        `[${profile.id}/${rule.id}] severity mismatch: registry=${rule.severity}, actual=${issue.severity}`
      );
    }
  }

  const negativeAst = parse(rule.negativeSnippet, profile);
  const negativeIssues = validate(negativeAst);
  const negativeMatches = negativeIssues.filter((i) => rule.messageMatcher.test(i.message));
  if (negativeMatches.length > 0) {
    throw new Error(
      `[${profile.id}/${rule.id}] negativeSnippet falsely triggered ${rule.messageMatcher}.\n` +
        `Matches: ${negativeMatches.map((i) => i.message).join(" | ")}`
    );
  }
}

function renderPackSection(pack) {
  const lines = [];
  lines.push(`## ${pack.name} (\`${pack.packageName}\`)`);
  lines.push("");
  const deprecatedCount = pack.rules.filter((r) => r.deprecatedSince !== undefined).length;
  if (deprecatedCount > 0) {
    lines.push(
      `Total rules: ${pack.rules.length} (of which ${deprecatedCount} soft-deprecated; suppress via \`--no-deprecated-rules\`)`
    );
  } else {
    lines.push(`Total rules: ${pack.rules.length}`);
  }
  lines.push("");
  lines.push("| Rule id | Severity | Deprecated since | Replacement suggestion | Summary |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const rule of pack.rules) {
    const idCell = rule.deprecatedSince !== undefined
      ? `\`${escapeCell(rule.id)}\` (deprecated)`
      : `\`${escapeCell(rule.id)}\``;
    const deprecatedCell = rule.deprecatedSince !== undefined
      ? escapeCell(rule.deprecatedSince)
      : "—";
    const replacementCell =
      rule.replacementSuggestion !== undefined ? escapeCell(rule.replacementSuggestion) : "—";
    lines.push(
      `| ${idCell} | ${escapeCell(rule.severity)} | ${deprecatedCell} | ${replacementCell} | ${escapeCell(rule.summary)} |`
    );
  }
  lines.push("");

  for (const rule of pack.rules) {
    lines.push(`### \`${rule.id}\``);
    lines.push("");
    lines.push(`- **Severity:** ${rule.severity}`);
    if (rule.deprecatedSince !== undefined) {
      lines.push(
        `- **Deprecated since:** ${rule.deprecatedSince} (suppressed by \`--no-deprecated-rules\`)`
      );
    }
    if (rule.replacementSuggestion !== undefined) {
      lines.push(`- **Replacement suggestion:** ${rule.replacementSuggestion}`);
    }
    lines.push(`- **Matcher:** \`${rule.messageMatcher.toString()}\``);
    lines.push(`- **Summary:** ${rule.summary}`);
    lines.push("");
    lines.push("**Triggers (positive):**");
    lines.push("");
    lines.push(snippetFence(rule.positiveSnippet));
    lines.push("");
    lines.push("**Does not trigger (negative):**");
    lines.push("");
    lines.push(snippetFence(rule.negativeSnippet));
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  for (const pack of PACKS) {
    for (const rule of pack.rules) {
      verifyRule(pack.profile, rule);
    }
  }

  const header = [
    "<!-- AUTO-GENERATED by scripts/generate-profile-pack-docs.mjs — DO NOT EDIT BY HAND. -->",
    "<!-- Re-run `npm run docs:profile-packs` after changing any rules.meta.ts file. -->",
    "",
    "# CNC Workbench — Profile-pack rules reference",
    "",
    "Each profile pack ships a stable, machine-checkable rule registry.",
    "Every entry below is verified at generation time against the pack's own `validateAst`.",
    ""
  ];

  const sections = PACKS.map(renderPackSection);
  const output = header.concat(sections).join("\n").trimEnd() + "\n";

  const outPath = path.join(repoRoot, "PROFILE_PACKS.md");
  await writeFile(outPath, output, "utf8");
  process.stdout.write(`Wrote ${outPath} (${PACKS.reduce((acc, p) => acc + p.rules.length, 0)} rules across ${PACKS.length} packs)\n`);
}

main().catch((err) => {
  process.stderr.write(`generate-profile-pack-docs failed: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
