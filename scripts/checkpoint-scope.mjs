import { execSync } from "node:child_process";

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

function getCheckpointHashes(limit) {
  const raw = run(`git log --pretty=format:%H --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw.split("\n").map((line) => line.trim()).filter(Boolean);
}

function getChangedFiles(hash) {
  const raw = run(`git show --pretty=format: --name-only ${hash}`);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
}

function topScope(filePath, depth) {
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length === 0) return "(root)";
  return parts.slice(0, Math.min(depth, parts.length)).join("/");
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "250", 250);
  const depth = parsePositiveInt(process.argv[3] ?? "2", 2);
  const topN = parsePositiveInt(process.argv[4] ?? "20", 20);
  const hashes = getCheckpointHashes(commitLimit);

  if (hashes.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const scopeCounts = new Map();
  const scopePresence = new Map();
  const scopePairs = new Map();
  let totalChangedFiles = 0;

  for (const hash of hashes) {
    const files = getChangedFiles(hash);
    if (files.length === 0) continue;
    totalChangedFiles += files.length;

    const scopes = files.map((file) => topScope(file, depth));
    const uniqueScopes = Array.from(new Set(scopes)).sort();

    for (const scope of scopes) {
      scopeCounts.set(scope, (scopeCounts.get(scope) ?? 0) + 1);
    }
    for (const scope of uniqueScopes) {
      scopePresence.set(scope, (scopePresence.get(scope) ?? 0) + 1);
    }

    if (uniqueScopes.length >= 2) {
      for (let i = 0; i < uniqueScopes.length; i += 1) {
        for (let j = i + 1; j < uniqueScopes.length; j += 1) {
          const key = `${uniqueScopes[i]}|||${uniqueScopes[j]}`;
          scopePairs.set(key, (scopePairs.get(key) ?? 0) + 1);
        }
      }
    }
  }

  if (scopeCounts.size === 0) {
    process.stdout.write("No scope data found in checkpoint commits.\n");
    return;
  }

  const rankedScopes = Array.from(scopeCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN);

  process.stdout.write(
    `Checkpoint scope hotspots (depth=${depth}, scanned ${hashes.length} checkpoints):\n`
  );
  process.stdout.write(`Total changed files considered: ${totalChangedFiles}\n`);
  process.stdout.write("Top scopes by changed-file volume:\n");
  for (let i = 0; i < rankedScopes.length; i += 1) {
    const [scope, count] = rankedScopes[i];
    const share = ((count / Math.max(1, totalChangedFiles)) * 100).toFixed(1);
    const seenIn = scopePresence.get(scope) ?? 0;
    process.stdout.write(
      `${String(i + 1).padStart(2, " ")}. ${scope}  files=${count}  share=${share}%  commits=${seenIn}\n`
    );
  }

  const rankedPairs = Array.from(scopePairs.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.min(10, topN));

  if (rankedPairs.length === 0) {
    process.stdout.write("No cross-scope co-change pairs found.\n");
    return;
  }

  process.stdout.write("Top cross-scope co-change pairs:\n");
  for (let i = 0; i < rankedPairs.length; i += 1) {
    const [key, count] = rankedPairs[i];
    const [left, right] = key.split("|||");
    process.stdout.write(
      `${String(i + 1).padStart(2, " ")}. ${left}  <->  ${right}  (${count})\n`
    );
  }
}

main();
