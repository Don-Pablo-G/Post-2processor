import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    const out = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    return { ok: true, out };
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";
    return { ok: false, out: `${stdout}\n${stderr}`.trim() };
  }
}

function parsePositiveInt(value, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.floor(raw);
}

function fmtNow() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function main() {
  const keepDigests = parsePositiveInt(process.argv[2] ?? "14", 14);
  const keepWeekly = parsePositiveInt(process.argv[3] ?? "12", 12);
  const keepReports = parsePositiveInt(process.argv[4] ?? "20", 20);

  const steps = [
    ["checkpoint:bootstrap", "npm run checkpoint:bootstrap"],
    ["checkpoint:weekly", "npm run checkpoint:weekly"],
    ["checkpoint:handoff:nightly", "npm run checkpoint:handoff:nightly"],
    [
      "checkpoint:cleanup",
      `node ./scripts/checkpoint-cleanup.mjs ${keepDigests} ${keepWeekly} ${keepReports}`
    ],
    ["checkpoint:index", "npm run checkpoint:index"]
  ];

  const results = [];
  for (const [name, command] of steps) {
    const res = run(command);
    results.push({ name, ...res });
  }

  const root = process.cwd();
  const outDir = path.resolve(root, ".checkpoints", "nightly");
  mkdirSync(outDir, { recursive: true });
  const dateTag = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outDir, `checkpoint-nightly-${dateTag}.md`);

  const lines = [];
  lines.push(`# Nightly Checkpoint Maintenance - ${dateTag}`);
  lines.push("");
  lines.push(`Generated: ${fmtNow()}`);
  lines.push("");
  lines.push("## Steps");
  for (const result of results) {
    lines.push(`- ${result.ok ? "OK" : "FAIL"} ${result.name}`);
  }
  lines.push("");
  lines.push("## Cleanup Parameters");
  lines.push(`- keepDigests: ${keepDigests}`);
  lines.push(`- keepWeekly: ${keepWeekly}`);
  lines.push(`- keepReports: ${keepReports}`);
  lines.push("");

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    lines.push("## Failures");
    for (const f of failed) {
      lines.push(`### ${f.name}`);
      lines.push("```");
      lines.push(f.out || "(no output)");
      lines.push("```");
    }
  } else {
    lines.push("All nightly maintenance steps completed successfully.");
  }
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Nightly report written: ${outputPath}\n`);
  for (const result of results) {
    process.stdout.write(`- ${result.ok ? "OK" : "FAIL"} ${result.name}\n`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
