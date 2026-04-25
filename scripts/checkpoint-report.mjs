import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getLatest(limit = 10) {
  const raw = run(`git log --date=iso --pretty=format:"%h|%ad|%s" --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    const [hash, date, subject] = line.split("|");
    return { hash, date, subject };
  });
}

function getStats() {
  const allRaw = run('git log --date=short --pretty=format:"%ad|%s" --grep="^checkpoint:"');
  const rows = allRaw ? allRaw.split("\n").filter(Boolean) : [];
  const total = rows.length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = rows.filter((line) => line.startsWith(`${todayKey}|`)).length;
  return { total, today, todayKey };
}

function main() {
  const root = run("git rev-parse --show-toplevel") || process.cwd();
  const latest = getLatest(10);
  const stats = getStats();
  const branch = run("git rev-parse --abbrev-ref HEAD") || "unknown";
  const head = run("git log -1 --oneline") || "unknown";

  const reportsDir = path.join(root, ".checkpoints", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `checkpoint-report-${nowStamp()}.md`);

  const lines = [];
  lines.push("# Checkpoint Report");
  lines.push("");
  lines.push(`- Branch: \`${branch}\``);
  lines.push(`- HEAD: \`${head}\``);
  lines.push(`- Total checkpoints: **${stats.total}**`);
  lines.push(`- Checkpoints today (${stats.todayKey}): **${stats.today}**`);
  lines.push("");
  lines.push("## Latest Checkpoints");
  if (latest.length === 0) {
    lines.push("- none");
  } else {
    for (const c of latest) {
      lines.push(`- \`${c.hash}\` ${c.date} — ${c.subject}`);
    }
  }
  lines.push("");
  lines.push("## Suggested Validation");
  lines.push("Run:");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run checkpoint:doctor");
  lines.push("npm run verify");
  lines.push("```");
  lines.push("");

  writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Checkpoint report written: ${reportPath}\n`);
}

main();
