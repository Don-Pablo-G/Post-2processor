#!/usr/bin/env node
import { appendFileSync, existsSync } from "node:fs";

function parseArg(name, fallback = "") {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 1);
}

const filePath = parseArg("--file", "E2E_STABILITY_LOG.md");
const date = parseArg("--date", new Date().toISOString().slice(0, 10));
const windowLabel = parseArg("--window", "last 10 CI runs");
const success = parseArg("--success", "-");
const failure = parseArg("--failure", "-");
const inProgress = parseArg("--in_progress", "-");
const failureClass = parseArg("--class", "other");
const notes = parseArg("--notes", "manual entry");

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const entry = `| ${date} | ${windowLabel} | ${success} | ${failure} | ${inProgress} | ${failureClass} | ${notes} |`;
appendFileSync(filePath, `\n${entry}`);
console.log(`Appended stability entry to ${filePath}`);
