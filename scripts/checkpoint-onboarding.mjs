import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parsePositiveInt(value, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.floor(raw);
}

function recentCheckpointCount(days = 7) {
  const raw = run(`git log --since="${days} days ago" --pretty=format:%h --grep="^checkpoint:"`);
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
}

function readCommandMap(root) {
  const mapPath = path.resolve(root, ".checkpoints", "maps", "checkpoint-command-map.md");
  if (!existsSync(mapPath)) return [];
  const text = readFileSync(mapPath, "utf8");
  return text
    .split("\n")
    .filter((line) => line.startsWith("- `checkpoint:"))
    .map((line) => line.replace(/^- `([^`]+)`.*$/, "$1"))
    .filter(Boolean);
}

function main() {
  const days = parsePositiveInt(process.argv[2] ?? "7", 7);
  const root = process.cwd();
  const outDir = path.resolve(root, ".checkpoints", "onboarding");
  mkdirSync(outDir, { recursive: true });
  const dateTag = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outDir, `checkpoint-onboarding-${dateTag}.md`);

  const recent = recentCheckpointCount(days);
  const commands = readCommandMap(root);
  const hasMap = commands.length > 0;

  const lines = [];
  lines.push(`# Checkpoint Onboarding Guide - ${dateTag}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Recent checkpoint activity (${days}d): ${recent}`);
  lines.push("");
  lines.push("## 1) Daily Starter Flow");
  lines.push("```bash");
  lines.push("npm run checkpoint:morning");
  lines.push("npm run verify");
  lines.push("```");
  lines.push("");
  lines.push("## 2) During Development");
  lines.push("- Use `npm run checkpoint:status` for quick local state.");
  lines.push("- Use `npm run checkpoint:brief` for standup-style updates.");
  lines.push("- Use `npm run checkpoint:ops` when you want release/cleanup context.");
  lines.push("");
  lines.push("## 3) Before Sharing/Release");
  lines.push("```bash");
  lines.push("npm run checkpoint:suite");
  lines.push("npm run checkpoint:release-ready");
  lines.push("npm run checkpoint:ship");
  lines.push("```");
  lines.push("");
  lines.push("## 4) Reporting/Archival");
  lines.push("```bash");
  lines.push("npm run checkpoint:digest");
  lines.push("npm run checkpoint:weekly");
  lines.push("npm run checkpoint:index");
  lines.push("```");
  lines.push("");
  lines.push("## 5) First Commands to Learn");
  if (!hasMap) {
    lines.push("- Generate command map first: `npm run checkpoint:command-map`");
  } else {
    commands.slice(0, 12).forEach((cmd) => lines.push(`- \`${cmd}\``));
  }
  lines.push("");
  lines.push("## Suggested Next Action");
  lines.push("- Run `npm run checkpoint:command-map` weekly to keep command discoverability current.");
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Onboarding guide written: ${outputPath}\n`);
}

main();
