#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function safeExec(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function readStdinJson() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  process.stdin.on("end", () => {
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }
    processPayload(payload);
  });
}

function processPayload(payload) {
  const command =
    payload.command ??
    payload.shell_command ??
    payload.tool_input?.command ??
    payload.input?.command ??
    "";

  const exitCode =
    payload.exitCode ??
    payload.exit_code ??
    payload.status ??
    payload.result?.exitCode ??
    payload.tool_output?.exit_code ??
    0;

  const commandText = String(command);
  const isVerification = /\bnpm run\b/.test(commandText) && /\b(test|typecheck|build)\b/.test(commandText);
  if (!isVerification) {
    return allow();
  }

  if (Number(exitCode) !== 0) {
    return allow();
  }

  const repoRoot = safeExec("git rev-parse --show-toplevel");
  if (!repoRoot) {
    return allow();
  }

  const branch = safeExec("git rev-parse --abbrev-ref HEAD") || "unknown-branch";
  const head = safeExec("git rev-parse --short HEAD") || "no-head";
  const status = safeExec("git status --short");
  if (!status) {
    return allow();
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const checkpointsDir = path.join(repoRoot, ".checkpoints");
  mkdirSync(checkpointsDir, { recursive: true });

  const unstagedPatch = safeExec("git diff --binary");
  const stagedPatch = safeExec("git diff --cached --binary");
  const untracked = safeExec("git ls-files --others --exclude-standard");

  const fileName = `checkpoint-${timestamp}.md`;
  const filePath = path.join(checkpointsDir, fileName);

  const body = [
    `# Checkpoint ${timestamp}`,
    "",
    `- branch: ${branch}`,
    `- head: ${head}`,
    `- trigger: ${commandText}`,
    "",
    "## Status",
    "```",
    status || "(clean)",
    "```",
    "",
    "## Staged Patch",
    "```diff",
    stagedPatch || "(none)",
    "```",
    "",
    "## Unstaged Patch",
    "```diff",
    unstagedPatch || "(none)",
    "```",
    "",
    "## Untracked Files",
    "```",
    untracked || "(none)",
    "```",
    ""
  ].join("\n");

  writeFileSync(filePath, body, "utf8");
  allow(`Checkpoint snapshot saved: ${path.relative(repoRoot, filePath)}`);
}

function allow(extraMessage = "") {
  const response = extraMessage
    ? {
        additional_context: extraMessage
      }
    : {};
  process.stdout.write(JSON.stringify(response));
}

readStdinJson();
