import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function printUsage() {
  process.stdout.write("Usage:\n");
  process.stdout.write("  npm run checkpoint:diff -- <from-hash> <to-hash>\n");
}

function isCommit(hash) {
  const resolved = run(`git show -s --format=%H ${hash}`);
  return /^[0-9a-f]{40}$/i.test(resolved);
}

function main() {
  const from = (process.argv[2] ?? "").trim();
  const to = (process.argv[3] ?? "").trim();
  if (!from || !to) {
    printUsage();
    process.exit(1);
  }

  if (!isCommit(from) || !isCommit(to)) {
    process.stderr.write(`Invalid commit hash(es): from="${from}" to="${to}"\n`);
    printUsage();
    process.exit(1);
  }

  const fromMsg = run(`git log -1 --oneline ${from}`);
  const toMsg = run(`git log -1 --oneline ${to}`);
  const stat = run(`git diff --shortstat ${from}..${to}`) || "No content differences.";
  const files = run(`git diff --name-status ${from}..${to}`) || "(none)";
  const commits = run(`git log --oneline --reverse ${from}..${to}`) || "(none)";

  process.stdout.write("Checkpoint diff summary:\n");
  process.stdout.write(`- from: ${fromMsg}\n`);
  process.stdout.write(`- to:   ${toMsg}\n`);
  process.stdout.write(`- stats: ${stat}\n\n`);

  process.stdout.write("Commits in range:\n");
  process.stdout.write(`${commits}\n\n`);

  process.stdout.write("Changed files:\n");
  process.stdout.write(`${files}\n`);
}

main();
