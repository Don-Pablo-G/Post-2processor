import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function getPayload(root, limit = 10) {
  const payloadPath = path.resolve(root, ".checkpoints", "webhook", "checkpoint-webhook-payload.json");
  if (existsSync(payloadPath)) {
    try {
      return JSON.parse(readFileSync(payloadPath, "utf8"));
    } catch {
      // fall through to regenerate
    }
  }

  const raw = run(`node scripts/checkpoint-webhook-payload.mjs ${limit}`);
  const start = raw.indexOf("{");
  if (start === -1) return null;
  try {
    return JSON.parse(raw.slice(start));
  } catch {
    return null;
  }
}

function fmtEpoch(epoch) {
  const d = new Date(epoch * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function main() {
  const root = process.cwd();
  const payload = getPayload(root, 12);
  if (!payload) {
    process.stdout.write("Unable to load checkpoint payload preview source.\n");
    process.exit(1);
    return;
  }

  const latest = payload.latest;
  const recent = Array.isArray(payload.recent) ? payload.recent : [];

  const lines = [];
  lines.push("Checkpoint Notification Preview");
  lines.push("");
  lines.push(`Status: ${payload.pulse}`);
  lines.push(`Branch: ${payload.repo?.branch ?? "unknown"}`);
  lines.push(`Dirty files: ${payload.repo?.dirty_count ?? 0}`);
  lines.push(
    `Activity: 24h=${payload.counters?.checkpoint_24h ?? 0}, 7d=${payload.counters?.checkpoint_7d ?? 0}`
  );

  if (latest) {
    lines.push(
      `Latest: ${latest.short_hash} at ${fmtEpoch(latest.epoch)} - ${latest.subject}`
    );
  } else {
    lines.push("Latest: none");
  }

  lines.push("");
  lines.push("Recent:");
  recent.slice(0, 5).forEach((item) => {
    lines.push(`- ${item.short_hash} ${fmtEpoch(item.epoch)} ${item.subject}`);
  });
  if (recent.length === 0) lines.push("- none");

  lines.push("");
  lines.push("Suggested action:");
  if ((payload.repo?.dirty_count ?? 0) > 0) {
    lines.push("- Clean working tree and run `npm run checkpoint:ship`.");
  } else {
    lines.push("- Run `npm run checkpoint:ship` for final GO/NO-GO.");
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

main();
