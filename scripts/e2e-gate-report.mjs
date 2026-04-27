#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

function parseArg(name, fallback) {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 1);
}

const limit = Number.parseInt(parseArg("--limit", "10"), 10);
const summaryOnly = process.argv.includes("--summary-only");
const githubSummary = process.argv.includes("--github-summary");
if (!Number.isFinite(limit) || limit <= 0) {
  console.error("Invalid --limit value. Example: node scripts/e2e-gate-report.mjs --limit=10");
  process.exit(1);
}

const ghBinaryCandidates = ["gh", "C:\\Program Files\\GitHub CLI\\gh.exe"].filter(
  (candidate) => candidate === "gh" || existsSync(candidate)
);

let raw = "";
let lastError = null;
for (const ghBinary of ghBinaryCandidates) {
  try {
    raw = execFileSync(
      ghBinary,
      [
        "run",
        "list",
        "--workflow",
        "ci.yml",
        "--limit",
        String(limit),
        "--json",
        "databaseId,headBranch,displayTitle,status,conclusion,createdAt,url"
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    lastError = null;
    break;
  } catch (error) {
    lastError = error;
  }
}

if (!raw) {
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  console.error("Failed to query GitHub Actions runs with gh CLI.");
  console.error(message);
  process.exit(1);
}

let runs = [];
try {
  runs = JSON.parse(raw);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to parse gh output.");
  console.error(message);
  process.exit(1);
}

const total = runs.length;
const failures = runs.filter((run) => run.conclusion === "failure").length;
const success = runs.filter((run) => run.conclusion === "success").length;
const inProgress = runs.filter((run) => run.status !== "completed").length;
const summaryLine = `success=${success} failure=${failures} in_progress=${inProgress}`;

if (githubSummary && process.env.GITHUB_STEP_SUMMARY) {
  console.log(`### Desktop E2E Gate Snapshot (last ${total} CI runs)`);
  console.log(`- ${summaryLine}`);
}

if (summaryOnly) {
  console.log(summaryLine);
  process.exit(0);
}

console.log(`E2E gate monitor (last ${total} CI runs)`);
console.log(summaryLine);
console.log("");
for (const run of runs) {
  const conclusion = run.conclusion ?? run.status;
  console.log(`${run.createdAt} | ${conclusion} | ${run.headBranch} | ${run.displayTitle}`);
  console.log(`  ${run.url}`);
}
