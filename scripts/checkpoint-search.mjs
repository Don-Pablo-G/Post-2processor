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
  process.stdout.write("  npm run checkpoint:search -- <keyword-or-regex>\n");
  process.stdout.write("Examples:\n");
  process.stdout.write("  npm run checkpoint:search -- verify\n");
  process.stdout.write("  npm run checkpoint:search -- \"browser|node\"\n");
}

function escapeDoubleQuotes(value) {
  return value.replace(/"/g, '\\"');
}

function main() {
  const query = (process.argv[2] ?? "").trim();
  if (!query) {
    printUsage();
    process.exit(1);
  }

  const grep = escapeDoubleQuotes(query);
  const raw = run(`git log --date=iso --pretty=format:"%h|%ad|%s" --grep="${grep}" --extended-regexp`);

  if (!raw) {
    process.stdout.write(`No commits matched query: ${query}\n`);
    return;
  }

  const lines = raw.split("\n");
  process.stdout.write(`Matched ${lines.length} commit(s) for query "${query}":\n`);
  for (const line of lines) {
    const [hash, date, subject] = line.split("|");
    process.stdout.write(`- ${hash}  ${date}  ${subject}\n`);
  }
}

main();
